import { Authenticator, Client } from 'minecraft-launcher-core'
import path, { join } from 'path'
import { app, BrowserWindow, screen } from 'electron'
import os from 'os'
import Logger from 'electron-log'
import { ChildProcessWithoutNullStreams } from 'child_process'
import { discordLogger } from './discord-logger'

const toMCLC = (token: string): unknown => {
  const data = JSON.parse(token)

  return {
    access_token: data.mcToken,
    client_token: data.profile.uuid,
    uuid: data.profile.id,
    name: data.profile.name,
    meta: {
      xuid: data.xuid,
      type: 'msa',
      demo: false,
      exp: data.exp,
      refresh: true
    }
  }
}

const nonPremiumToMCLC = async (json: string): Promise<unknown> => {
  const profile = JSON.parse(json)
  const res = await Authenticator.getAuth(profile.nickname)

  return {
    ...res,
    uuid: profile.uuid
  }
}

const getBaseVersionByMode = (mode: string): string => {
  if (mode === 'fantasy') return '1.20.1' // vanilla baza pod Forge
  if (mode === 'pokemons') return '1.21.1' // vanilla baza pod Fabric
  return '1.21.1' // fallback
}

const getCustomVersionByMode = (mode: string): string | undefined => {
  if (mode === 'fantasy') return '1.20.1-forge-47.4.10' // pełne ID Forge (lokalny profil)
  if (mode === 'pokemons') return '1.21.1-fabric' // pełne ID Fabric (lokalny profil)
  return undefined
}

export type DisplayMode = 'Pełny ekran' | 'Okno'

export interface MinecraftSettings {
  ram: number
  resolution: string
  displayMode: DisplayMode
  gameMode: string
}

export interface MinecraftInstanceConfig {
  token: string
  accessToken: string
  accountType: 'microsoft' | 'nonPremium'
  settings: MinecraftSettings
  window: BrowserWindow
}

export interface MinecraftInstance {
  mcOpened: boolean
  process: number | null
  start: () => Promise<void>
  stop: () => Promise<void>
}

function resolveJavaPath(baseDir: string): string {
  const plt = os.platform()

  return join(
    baseDir,
    'java',
    plt === 'win32'
      ? 'jdk-21.0.8/bin/java.exe'
      : plt === 'darwin'
        ? 'jdk-21.0.8.jdk/Contents/Home/bin/java'
        : 'jdk-21.0.8/bin/java'
  )
}

function computeResolution(
  displayMode: DisplayMode,
  resolution: string
): { width: number; height: number; fullscreen: boolean } {
  const { width: fullWidth, height: fullHeight } = screen.getPrimaryDisplay().bounds
  const fullscreen = displayMode === 'Pełny ekran'
  if (fullscreen) {
    return { width: fullWidth, height: fullHeight, fullscreen }
  }
  const [widthStr, heightStr] = resolution.split('x')
  const width = parseInt(widthStr, 10)
  const height = parseInt(heightStr, 10)
  return { width, height, fullscreen }
}

export function createMinecraftInstance(config: MinecraftInstanceConfig): MinecraftInstance {
  const { token, accessToken, accountType, settings, window } = config

  // Extract nickname for Discord logging
  let nickname = 'Unknown'
  try {
    const data = JSON.parse(token)
    nickname = accountType === 'microsoft' ? data.profile.name : data.nickname
  } catch {
    // ignore
  }
  const baseDir = app.getPath('userData')
  const minecraftDir = path.join(baseDir, 'instances', settings.gameMode.toLowerCase())
  const client = new Client()
  const javaPath = resolveJavaPath(baseDir)

  let mcOpened = false
  let childProcess: ChildProcessWithoutNullStreams | null = null

  const start = async (): Promise<void> => {
    const { width, height, fullscreen } = computeResolution(
      settings.displayMode,
      settings.resolution
    )

    const authorization =
      accountType === 'microsoft' ? toMCLC(token) : await nonPremiumToMCLC(token)

    Logger.log('PokeGoGo Launcher > MC Starting')
    window.webContents.send('launch:change-state', JSON.stringify('minecraft-start'))

    const baseVersion = getBaseVersionByMode(settings.gameMode)
    const customVersion = getCustomVersionByMode(settings.gameMode)

    Logger.log('MC root dir:', minecraftDir)
    Logger.log('MC javaPath:', javaPath)
    Logger.log('MC baseVersion:', baseVersion)
    Logger.log('MC customVersion:', customVersion)

    // LISTENERY ZANIM ODPALISZ launch
    client.on('debug', (data) => {
      Logger.log('MC DEBUG:', data)
    })

    client.on('data', (data) => {
      Logger.log('MC STDOUT:', String(data))
      window.webContents.send('launch:show-log', data)

      if (typeof data === 'string') {
        if (data.includes('[Error]') || data.includes('Exception') || data.includes('FATAL')) {
          discordLogger.sendError('Game Client Error', data, nickname)
        }
      }
    })

    client.on('error', (err) => {
      Logger.error('MC ERROR event:', err)
    })

    client.on('close', (code) => {
      Logger.log('PokeGoGo Launcher > MC Closed with code', code)
      window.webContents.send('launch:change-state', JSON.stringify('minecraft-closed'))

      if (code !== 0 && code !== 130 && code !== 143 && mcOpened) {
        discordLogger.sendError('Game Client Crashed', `Exit code: ${code}`, nickname)
      }

      mcOpened = false
      window.show()
    })

    try {
      childProcess = await client.launch({
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        authorization,
        root: minecraftDir,
        javaPath,
        version: {
          number: baseVersion, // '1.20.1' lub '1.21.1'
          type: 'release',
          custom: customVersion // '1.20.1-forge-47.4.10' albo '1.21.1-fabric' albo undefined
        },
        window: {
          width,
          height,
          fullscreen
        },
        memory: {
          max: `${settings.ram}G`,
          min: `4G`
        },
        customArgs: [`-DaccessToken=${accessToken}`]
      })

      Logger.log('PokeGoGo Launcher > PID', childProcess?.pid, 'started')

      window.webContents.send('launch:change-state', JSON.stringify('minecraft-started'))
      mcOpened = true

      // NA RAZIE NIE CHOWAJ OKNA, ŻEBY ZOBACZYĆ CO SIĘ DZIEJE
      // if (plt !== 'darwin') window.hide()
    } catch (e) {
      Logger.error('PokeGoGo Launcher > MC launch THROW:', e)
      window.webContents.send('launch:change-state', JSON.stringify('minecraft-closed'))
      mcOpened = false
    }
  }

  const stop = async (): Promise<void> => {
    try {
      client.emit('close', 1)
      if (childProcess) childProcess.kill('SIGTERM')
    } catch (e) {
      Logger.error('PokeGoGo Launcher > Error killing minecraft process', e)
    } finally {
      mcOpened = false
      window.webContents.send('launch:change-state', JSON.stringify('minecraft-closed'))
      window.show()
      childProcess = null
    }
  }

  return {
    get mcOpened() {
      return mcOpened
    },
    get process() {
      return childProcess?.pid ?? null
    },
    start,
    stop
  }
}
