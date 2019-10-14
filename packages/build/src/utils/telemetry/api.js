const { spawn } = require('child_process')
const { join } = require('path')

module.exports = function sendData(payload, version) {
  const args = JSON.stringify({
    data: payload,
    type: payload.type,
    version: version
  })
  // Spawn detached child process to send telemetry
  spawn(process.execPath, [ join(__dirname, 'request.js'), args ], {
    detached: true,
    stdio: 'ignore'
  }).unref()
}
