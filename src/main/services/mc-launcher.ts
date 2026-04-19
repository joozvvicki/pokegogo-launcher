import { Authenticator, Client } from 'minecraft-launcher-core'
import path, { join } from 'path'
import { readFileSync, readdirSync, statSync, unlinkSync, existsSync } from 'fs'
import { app, BrowserWindow, screen } from 'electron'
import os from 'os'
import Logger from 'electron-log'
import { ChildProcessWithoutNullStreams } from 'child_process'
import { discordLogger } from './discord-logger'
import { findMinecraftProcess } from '../utils/game-scanner'

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

const getJavaVersionByMode = (mode: string): string => {
  if (mode === 'fantasy') return '17'
  return '21'
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

function resolveJavaPath(baseDir: string, version: string): string {
  const plt = os.platform()
  const folderName = version === '17' ? 'jdk-17.0.12' : 'jdk-21.0.8'

  return join(
    baseDir,
    'java',
    plt === 'win32'
      ? `${folderName}/bin/java.exe`
      : plt === 'darwin'
        ? `${folderName}.jdk/Contents/Home/bin/java`
        : `${folderName}/bin/java`
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

/**
 * Scan the config directory and remove any 0-byte files that could cause crashes.
 */
function fixCorruptedConfigs(minecraftDir: string): void {
  const configDir = join(minecraftDir, 'config')
  if (!existsSync(configDir)) return

  try {
    const files = readdirSync(configDir)
    for (const file of files) {
      const filePath = join(configDir, file)
      const stats = statSync(filePath)

      if (stats.isFile() && stats.size === 0) {
        Logger.log(`PokeGoGo Launcher > Cleaning up corrupted (0-byte) config file: ${file}`)
        unlinkSync(filePath)
      }
    }
  } catch (e) {
    Logger.error('PokeGoGo Launcher > Error while cleaning up corrupted config files:', e)
  }
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
  const javaVersion = getJavaVersionByMode(settings.gameMode.toLowerCase())
  const javaPath = resolveJavaPath(baseDir, javaVersion)

  let mcOpened = false
  let childProcess: ChildProcessWithoutNullStreams | null = null
  let monitoringInterval: NodeJS.Timeout | null = null

  const start = async (): Promise<void> => {
    const { width, height, fullscreen } = computeResolution(
      settings.displayMode,
      settings.resolution
    )

    const authorization =
      accountType === 'microsoft' ? toMCLC(token) : await nonPremiumToMCLC(token)

    Logger.log('PokeGoGo Launcher > MC Starting')
    window.webContents.send('launch:change-state', JSON.stringify('minecraft-start'))

    // Pre-launch cleanup
    fixCorruptedConfigs(minecraftDir)

    const baseVersion = getBaseVersionByMode(settings.gameMode.toLowerCase())
    const customVersion = getCustomVersionByMode(settings.gameMode.toLowerCase())

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

    let customArgs: string[] = [
      `-DaccessToken=${accessToken}`,
      '-Dforge.updateCheckEnable=false',
      '-Dchecker.update=false',
      '-DCDAGaming.update_check=false',
      '-DCDAGaming.updateCheck=false',
      '-Dunilib.check_updates=false',
      '-Dversioncheck.enable=false'
    ]

    if (settings.gameMode === 'fantasy' && customVersion) {
      const versionJsonPath = join(minecraftDir, 'versions', customVersion, `${customVersion}.json`)
      try {
        const versionJson = JSON.parse(readFileSync(versionJsonPath, 'utf-8'))
        if (versionJson.arguments && versionJson.arguments.jvm) {
          const separator = process.platform === 'win32' ? ';' : ':'
          const jvmArgs = versionJson.arguments.jvm
            .filter((arg: any) => typeof arg === 'string')
            .map((arg: string) => {
              return arg
                .replace(/\${library_directory}/g, join(minecraftDir, 'libraries'))
                .replace(/\${classpath_separator}/g, separator)
                .replace(/\${version_name}/g, customVersion)
            })
          customArgs = [...customArgs, ...jvmArgs]
        }
      } catch (e) {
        Logger.error('PokeGoGo Launcher > Error parsing version JSON for JVM args:', e)
      }
    }

    try {
      childProcess = await client.launch({
        // @ts-ignore: MCLC types might be incomplete or mismatching
        authorization,
        root: minecraftDir,
        javaPath,
        version: {
          number: baseVersion,
          type: 'release',
          custom: customVersion
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
        customArgs
      })

      Logger.log('PokeGoGo Launcher > PID', childProcess?.pid, 'started')

      window.webContents.send(
        'launch:change-state',
        JSON.stringify('minecraft-started'),
        childProcess?.pid
      )
      mcOpened = true

      // Start periodic robustness check
      if (monitoringInterval) clearInterval(monitoringInterval)
      monitoringInterval = setInterval(async () => {
        const pid = await findMinecraftProcess(minecraftDir)
        const currentlyRunning = !!pid

        if (mcOpened && !currentlyRunning) {
          // Game closed externally or crashed silently
          Logger.log('PokeGoGo Launcher > Game no longer detected in processes. Cleaning up.')
          mcOpened = false
          window.webContents.send('launch:change-state', JSON.stringify('minecraft-closed'))
          if (monitoringInterval) {
            clearInterval(monitoringInterval)
            monitoringInterval = null
          }
        } else if (!mcOpened && currentlyRunning) {
          // Game was found running but launcher didn't know (e.g. after restart)
          Logger.log('PokeGoGo Launcher > Game detected running in background. Syncing state.')
          mcOpened = true
          window.webContents.send('launch:change-state', JSON.stringify('minecraft-started'), pid)
        }
      }, 30000)
    } catch (e) {
      Logger.error('PokeGoGo Launcher > MC launch THROW:', e)
      window.webContents.send('launch:change-state', JSON.stringify('minecraft-closed'))
      mcOpened = false
    }
  }

  const stop = async (): Promise<void> => {
    const processToKill = childProcess
    try {
      client.emit('close', 1)
      if (processToKill) {
        if (os.platform() === 'win32') {
          import('child_process')
            .then((cp) => {
              cp.exec(`taskkill /pid ${processToKill.pid} /T /F`, (err) => {
                if (err) processToKill.kill('SIGTERM')
              })
            })
            .catch(() => {
              processToKill.kill('SIGTERM')
            })
        } else {
          processToKill.kill('SIGTERM')
        }
      }
    } catch (e) {
      Logger.error('PokeGoGo Launcher > Error killing minecraft process', e)
    } finally {
      mcOpened = false
      if (monitoringInterval) {
        clearInterval(monitoringInterval)
        monitoringInterval = null
      }
      window.webContents.send('launch:change-state', JSON.stringify('minecraft-closed'))
      window.show()
      childProcess = null
    }
  }

  // Pre-sync on instance creation (detect existing game)
  setTimeout(async () => {
    const existingPid = await findMinecraftProcess(minecraftDir)
    if (existingPid) {
      Logger.log('PokeGoGo Launcher > Active game detected on startup for:', settings.gameMode)
      mcOpened = true
      window.webContents.send('launch:change-state', JSON.stringify('minecraft-started'), existingPid)
      
      // Start monitoring for this re-detected instance
      if (monitoringInterval) clearInterval(monitoringInterval)
      monitoringInterval = setInterval(async () => {
        const pid = await findMinecraftProcess(minecraftDir)
        if (!pid && mcOpened) {
          mcOpened = false
          window.webContents.send('launch:change-state', JSON.stringify('minecraft-closed'))
          if (monitoringInterval) {
            clearInterval(monitoringInterval)
            monitoringInterval = null
          }
        }
      }, 30000)
    }
  }, 5000)

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
