import os from 'os'
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { exec } from 'child_process'
import https from 'https'
import http from 'http'

export function ensureDir(dir: string): void {
  if (existsSync(dir)) {
    const stat = statSync(dir)
    if (!stat.isDirectory()) {
      unlinkSync(dir)
    }
  }
  mkdirSync(dir, { recursive: true })
}

export function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    mod
      .get(url, (response) => {
        // Obsługa przekierowania
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          downloadFile(response.headers.location, dest).then(resolve).catch(reject)
          return
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Nie udało się pobrać pliku. Status: ${response.statusCode}`))
          return
        }
        const file = createWriteStream(dest)
        response.pipe(file)
        file.on('finish', () => {
          file.close()
          resolve()
        })
        file.on('error', (err) => {
          reject(err)
        })
      })
      .on('error', (err) => {
        reject(err)
      })
  })
}

export const getMaxRAMInGB = (): number => {
  const totalMemoryBytes = os.totalmem()
  const totalMemoryGB = totalMemoryBytes / 1024 ** 3
  return Math.floor(totalMemoryGB)
}

export const getPersistentMachineId = (fallbackId?: string): string => {
  const paths = [
    join(os.homedir(), '.pokegogo_sys_id'),
    join(
      process.env.APPDATA ||
        (process.platform === 'darwin' ? join(os.homedir(), 'Library/Preferences') : os.homedir()),
      '.pg_sys_id'
    ),
    join(process.env.LOCALAPPDATA || os.tmpdir(), '.sys_id_cache')
  ]

  let id: string | null = null

  // 1. Try to find the ID in any of the paths (Priority: Persistent Files)
  for (const p of paths) {
    try {
      if (existsSync(p)) {
        const content = readFileSync(p, 'utf8').trim()
        if (content && content.length > 32) {
          // UUID or MachineID length check
          id = content
          break
        }
      }
    } catch (err) {
      // Silently fail for individual paths
    }
  }

  // 2. If not found in files, use the provided systemId or generate a new one
  if (!id) {
    id = fallbackId || randomUUID()
  }

  // 3. Sync ID to all paths (healing/creation)
  for (const p of paths) {
    try {
      let needsWrite = false
      if (!existsSync(p)) {
        needsWrite = true
      } else {
        const current = readFileSync(p, 'utf8').trim()
        if (current !== id) {
          needsWrite = true
        }
      }

      if (needsWrite) {
        const parent = join(p, '..')
        if (!existsSync(parent)) {
          mkdirSync(parent, { recursive: true })
        }
        writeFileSync(p, id, 'utf8')

        // Hide file
        if (process.platform === 'darwin') {
          exec(`chflags hidden "${p}"`)
        } else if (process.platform === 'win32') {
          exec(`attrib +h "${p}"`)
        }
      }
    } catch (err) {
      // Silently fail for individual paths
    }
  }

  return id
}
