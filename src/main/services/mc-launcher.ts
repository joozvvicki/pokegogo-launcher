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
  if (mode === 'create') return '1.20.1' // vanilla baza pod Fabric
  if (mode === 'pokemons') return '1.21.1' // vanilla baza pod Fabric
  return '1.21.1' // fallback
}

const getCustomVersionByMode = (mode: string): string | undefined => {
  if (mode === 'create') return '1.20.1-fabric' // pełne ID Fabric (lokalny profil)
  if (mode === 'pokemons') return '1.21.1-fabric' // pełne ID Fabric (lokalny profil)
  return undefined
}

const getJavaVersionByMode = (mode: string): string => {
  if (mode === 'create') return '21'
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
  let isAborted = false

  const start = async (): Promise<void> => {
    // Prevent multiple concurrent launch attempts
    if (mcOpened) {
      Logger.log('PokeGoGo Launcher > Game already marked as opened. Skipping start.')
      window.webContents.send(
        'launch:change-state',
        JSON.stringify('minecraft-started'),
        childProcess?.pid
      )
      return
    }

    // Safety check: Kill any existing Minecraft process for this instance before starting
    const existingPid = await findMinecraftProcess(minecraftDir)
    if (existingPid) {
      Logger.log(
        `PokeGoGo Launcher > Found existing game process (PID: ${existingPid}). Terminating before new launch.`
      )
      try {
        if (os.platform() === 'win32') {
          const { execSync } = await import('child_process')
          execSync(`taskkill /pid ${existingPid} /T /F`, { stdio: 'ignore' })
        } else {
          process.kill(existingPid, 'SIGTERM')
        }
        // Give it a moment to release files
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (err) {
        Logger.warn('PokeGoGo Launcher > Failed to kill existing process:', err)
      }
    }

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
      if (!window.isDestroyed()) window.webContents.send('launch:show-log', data)

      if (typeof data === 'string') {
        if (data.includes('[Error]') || data.includes('Exception') || data.includes('FATAL')) {
          discordLogger.sendError('Game Client Error', data, nickname)
        }
      }
    })

    client.on('error', (err) => {
      Logger.error('MC ERROR event:', err)
    })

    client.on('close', async (code) => {
      Logger.log(`PokeGoGo Launcher > MC Process (PID ${childProcess?.pid}) closed with code`, code)

      // Double check if the process is TRULY gone (sometimes wrapper exits but game remains)
      const stillRunningPid = await findMinecraftProcess(minecraftDir)
      if (stillRunningPid) {
        Logger.log(
          `PokeGoGo Launcher > MC Process reported closed, but found another instance (PID ${stillRunningPid}). Keeping state as started.`
        )
        mcOpened = true
        if (!window.isDestroyed())
          window.webContents.send(
            'launch:change-state',
            JSON.stringify('minecraft-started'),
            stillRunningPid
          )
        return
      }

      if (!window.isDestroyed())
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

    if (settings.gameMode === 'create' && customVersion) {
      const versionJsonPath = join(minecraftDir, 'versions', customVersion, `${customVersion}.json`)
      try {
        const versionJson = JSON.parse(readFileSync(versionJsonPath, 'utf-8'))
        if (versionJson.arguments && versionJson.arguments.jvm) {
          const separator = process.platform === 'win32' ? ';' : ':'
          const jvmArgs = versionJson.arguments.jvm
            .filter((arg: unknown) => typeof arg === 'string')
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

      if (isAborted) {
        Logger.log('PokeGoGo Launcher > Launch aborted during client.launch(). Killing immediately.')
        if (childProcess) {
          if (os.platform() === 'win32') {
            import('child_process').then(cp => {
              cp.exec(`taskkill /pid ${childProcess!.pid} /T /F`, () => {})
            }).catch(() => {
              childProcess!.kill('SIGTERM')
            })
          } else {
            childProcess.kill('SIGTERM')
          }
        }
        childProcess = null
        return
      }

      Logger.log('PokeGoGo Launcher > PID', childProcess?.pid, 'started')

      if (!window.isDestroyed()) {
        window.webContents.send(
          'launch:change-state',
          JSON.stringify('minecraft-started'),
          childProcess?.pid
        )
      }
      mcOpened = true

      // Start periodic robustness check (increased frequency: 5s)
      if (monitoringInterval) clearInterval(monitoringInterval)
      monitoringInterval = setInterval(async () => {
        const pidFromScan = await findMinecraftProcess(minecraftDir)
        let currentlyRunning = !!pidFromScan
        let activePid = pidFromScan

        // Secondary check: if scanner failed, but we have a childProcess PID, check it directly
        if (!currentlyRunning && childProcess?.pid) {
          try {
            process.kill(childProcess.pid, 0)
            currentlyRunning = true
            activePid = childProcess.pid
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (e) {
            // Process truly dead
          }
        }

        if (mcOpened && !currentlyRunning) {
          // Game closed externally or crashed silently
          Logger.log(
            `PokeGoGo Launcher > Game for ${settings.gameMode} no longer detected in processes. Sending closed state.`
          )
          mcOpened = false
          if (!window.isDestroyed())
            window.webContents.send('launch:change-state', JSON.stringify('minecraft-closed'))
          if (monitoringInterval) {
            clearInterval(monitoringInterval)
            monitoringInterval = null
          }
        } else if (!mcOpened && currentlyRunning) {
          // Game was found running but launcher didn't know
          Logger.log(
            `PokeGoGo Launcher > Game for ${settings.gameMode} detected running (PID ${activePid}). Sending started state.`
          )
          mcOpened = true
          if (!window.isDestroyed())
            window.webContents.send(
              'launch:change-state',
              JSON.stringify('minecraft-started'),
              activePid
            )
        }
      }, 5000)
    } catch (e) {
      Logger.error('PokeGoGo Launcher > MC launch THROW:', e)
      if (!window.isDestroyed())
        window.webContents.send('launch:change-state', JSON.stringify('minecraft-closed'))
      mcOpened = false
    }
  }

  const stop = async (): Promise<void> => {
    isAborted = true
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
      if (!window.isDestroyed())
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
      if (!window.isDestroyed()) {
        window.webContents.send(
          'launch:change-state',
          JSON.stringify('minecraft-started'),
          existingPid
        )
      }

      // Start monitoring for this re-detected instance
      if (monitoringInterval) clearInterval(monitoringInterval)
      monitoringInterval = setInterval(async () => {
        const pid = await findMinecraftProcess(minecraftDir)
        if (!pid && mcOpened) {
          Logger.log('PokeGoGo Launcher > Background game for', settings.gameMode, 'closed.')
          mcOpened = false
          if (!window.isDestroyed())
            window.webContents.send('launch:change-state', JSON.stringify('minecraft-closed'))
          if (monitoringInterval) {
            clearInterval(monitoringInterval)
            monitoringInterval = null
          }
        }
      }, 5000)
    }
  }, 2000)

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
