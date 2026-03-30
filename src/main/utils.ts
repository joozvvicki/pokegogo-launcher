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

export const getPersistentMachineId = (): string => {
  const filePath = join(os.homedir(), '.pokegogo_sys_id')
  try {
    if (existsSync(filePath)) {
      const id = readFileSync(filePath, 'utf8').trim()
      if (id && id.length > 0) {
        return id
      }
    }
  } catch (err) {
    console.error('Failed to read persistent machine ID:', err)
  }

  const newId = randomUUID()
  try {
    writeFileSync(filePath, newId, 'utf8')
    if (process.platform === 'darwin') {
      exec(`chflags hidden "${filePath}"`, (err) => {
        if (err) console.error('Failed to set hidden flag on macOS:', err)
      })
    } else if (process.platform === 'win32') {
      exec(`attrib +h "${filePath}"`, (err) => {
        if (err) console.error('Failed to set hidden flag on Windows:', err)
      })
    }
  } catch (err) {
    console.error('Failed to write persistent machine ID:', err)
  }
  return newId
}
