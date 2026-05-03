const { getPersistentMachineId } = require('./src/main/utils.ts')
const os = require('os')
const path = require('path')
const fs = require('fs')

async function testHwid() {
  console.log('Testing Persistent HWID (3-file logic)...')
  const id1 = getPersistentMachineId()
  console.log('Initial ID:', id1)

  const paths = [
    path.join(os.homedir(), '.pokegogo_sys_id'),
    path.join(
      process.env.APPDATA ||
        (process.platform === 'darwin'
          ? path.join(os.homedir(), 'Library/Preferences')
          : os.homedir()),
      '.pg_sys_id'
    ),
    path.join(process.env.LOCALAPPDATA || os.tmpdir(), '.sys_id_cache')
  ]

  // Check existence and content
  paths.forEach((p) => {
    if (!fs.existsSync(p)) {
      console.error(`FAILURE: File missing: ${p}`)
      process.exit(1)
    } else {
      const content = fs.readFileSync(p, 'utf8').trim()
      if (content !== id1) {
        console.error(`FAILURE: Content mismatch at ${p}`)
        process.exit(1)
      } else {
        console.log(`SUCCESS: Verified ${p}`)
      }
    }
  })

  // Test recovery: Delete first file
  console.log(`\nDeleting: ${paths[0]}`)
  fs.unlinkSync(paths[0])

  const id2 = getPersistentMachineId()
  console.log('ID after recovery attempt:', id2)

  if (id1 === id2 && fs.existsSync(paths[0])) {
    console.log('SUCCESS: Backup was used to restore the deleted file.')
  } else {
    console.error('FAILURE: Recovery failed!')
    process.exit(1)
  }

  // Test tampering: Modify second file
  console.log(`\nTampering with: ${paths[1]}`)
  fs.writeFileSync(paths[1], 'TAMPERED-ID-123', 'utf8')

  const id3 = getPersistentMachineId()
  console.log('ID after tampering check:', id3)

  const recoveredContent = fs.readFileSync(paths[1], 'utf8').trim()
  if (id1 === id3 && recoveredContent === id1) {
    console.log('SUCCESS: Tampered file was repaired using valid backups.')
  } else {
    console.error('FAILURE: Tamper repair failed!')
    process.exit(1)
  }

  console.log('\nALL TESTS PASSED SUCCESSFULLY!')
}

testHwid().catch(console.error)
