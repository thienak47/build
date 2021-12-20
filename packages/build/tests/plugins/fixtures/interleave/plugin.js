import { promisify } from 'util'

// TODO: replace with `timers/promises` after dropping Node < 15.0.0
const pSetTimeout = promisify(setTimeout)

// 100ms
const LOG_TIMEOUT = 1e2

export default {
  async onPreBuild() {
    console.log('one')
    await pSetTimeout(LOG_TIMEOUT)
    console.error('two')
    await pSetTimeout(LOG_TIMEOUT)
    console.log('three')
  },
}
