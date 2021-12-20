import { env, kill } from 'process'
import { promisify } from 'util'

import processExists from 'process-exists'

// TODO: replace with `timers/promises` after dropping Node < 15.0.0
const pSetTimeout = promisify(setTimeout)

// 100ms
const PROCESS_TIMEOUT = 1e2

export default {
  async onBuild() {
    kill(env.TEST_PID)

    // Signals are async, so we need to wait for the child process to exit
    // The while loop is required due to `await`
    // eslint-disable-next-line fp/no-loops, no-await-in-loop
    while (await processExists(env.TEST_PID)) {
      // eslint-disable-next-line no-await-in-loop
      await pSetTimeout(PROCESS_TIMEOUT)
    }
  },
}
