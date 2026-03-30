const { getPersistentMachineId } = require('./src/main/utils.ts')
const os = require('os')
const path = require('path')
const fs = require('fs')

async function testHwid() {
  console.log('Testing Persistent HWID...')
  const id1 = getPersistentMachineId()
  console.log('Generated/Retrieved ID 1:', id1)

  const id2 = getPersistentMachineId()
  console.log('Retrieved ID 2:', id2)

  if (id1 === id2) {
    console.log('SUCCESS: IDs match across retrievals.')
  } else {
    console.error('FAILURE: IDs do not match!')
    process.exit(1)
  }

  const filePath = path.join(os.homedir(), '.pokegogo_sys_id')
  if (fs.existsSync(filePath)) {
    console.log('SUCCESS: Hidden file exists at', filePath)
  } else {
    console.error('FAILURE: Hidden file not found!')
    process.exit(1)
  }
}

testHwid().catch(console.error)
