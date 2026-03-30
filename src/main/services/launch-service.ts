/* eslint-disable @typescript-eslint/no-explicit-any */
import { app, type BrowserWindow, ipcMain } from 'electron'
import { installJava } from './installers/java-installer'
import { copyMCFiles } from './installers/mc-installer'
import { createMinecraftInstance, MinecraftInstance } from './mc-launcher'
import Logger from 'electron-log'
import { join } from 'path'
import { rm, unlink } from 'fs/promises'

export const useLaunchService = (win: BrowserWindow): void => {
  const minecraftInstances: MinecraftInstance[] = []
  let currentAbortController: AbortController | null = null
  let pendingInstance: MinecraftInstance | null = null

  ipcMain.handle('launch:game', async (_, data) => {
    let currentInstance: MinecraftInstance | null = null

    if (currentAbortController) {
      currentAbortController.abort()
    }

    currentAbortController = new AbortController()
    const signal = currentAbortController.signal

    win.webContents.send('launch:change-state', JSON.stringify('java-install'))
    await installJava(data.javaVersion)
    win.webContents.send('launch:change-state', JSON.stringify('files-verify'))

    // We don't register launch:exit here anymore. It's global.
    const res = await copyMCFiles(data.isDev, data.settings.gameMode, win, signal)

    currentAbortController = null

    if (res === 'stop') {
      Logger.log('Game launch aborted during verification.')
      return null
    }

    if (res !== 'stop') {
      currentInstance = createMinecraftInstance({
        accessToken: data.accessToken,
        accountType: data.accountType,
        window: win,
        settings: data.settings,
        token: data.token
      })

      pendingInstance = currentInstance
      minecraftInstances.push(currentInstance)

      try {
        await currentInstance.start()
      } finally {
        pendingInstance = null
      }
    }

    return currentInstance?.process
  })

  // Global exit handler
  ipcMain.handle('launch:exit', async (_, pid: number | null) => {
    // 1. Abort verification/download
    if (currentAbortController) {
      currentAbortController.abort()
      currentAbortController = null
      Logger.log('Cancel process triggered via launch:exit')
    }

    // 2. Kill specific process if running
    if (pid) {
      const instance = minecraftInstances.find((instance) => instance.process === pid)
      if (instance) {
        await instance.stop()
        // Remove from list
        const index = minecraftInstances.indexOf(instance)
        if (index > -1) minecraftInstances.splice(index, 1)
      }
    } else if (pendingInstance) {
      // 3. Fallback: Kill pending instance (stuck in start/launch phase)
      Logger.log('Killing pending instance via launch:exit fallback')
      await pendingInstance.stop()
      const index = minecraftInstances.indexOf(pendingInstance)
      if (index > -1) minecraftInstances.splice(index, 1)
      pendingInstance = null
    }
  })

  ipcMain.handle('launch:check-files', async (_, data): Promise<any> => {
    if (currentAbortController) {
      currentAbortController.abort()
    }

    currentAbortController = new AbortController()
    const signal = currentAbortController.signal

    try {
      const res = await copyMCFiles(data.isDev, data.gameMode, win, signal, data.event)
      currentAbortController = null

      if (res !== 'stop') {
        return true
      }

      return false
    } catch (err) {
      Logger.log(err)

      return false
    }
  })

  ipcMain.handle('launch:remove-markfile', async (_, gameMode: string): Promise<boolean> => {
    try {
      await unlink(
        join(app.getPath('userData'), 'instances', `.${gameMode.toLowerCase()}_installed`)
      )
    } catch (err) {
      Logger.log(err)

      return false
    }

    return false
  })

  ipcMain.handle('launch:remove-mcfiles', async (_, gameMode: string): Promise<boolean> => {
    try {
      await rm(join(app.getPath('userData'), 'instances', gameMode.toLowerCase()), {
        recursive: true,
        force: true
      })
    } catch (err) {
      Logger.log(err)

      return false
    }

    return false
  })

  ipcMain.handle('launch:exit-verify', (_, event = 'launch:show-log') => {
    if (currentAbortController) {
      currentAbortController.abort()
      win.webContents.send(event, '', true)
      Logger.log('Cancel veryfing..')
      return Promise.resolve()
    }

    return Promise.resolve()
  })
}
