import { resolve } from 'path'
import { fileURLToPath } from 'url'

const CURRENT_DIR = fileURLToPath(new URL('.', import.meta.url))

export default {
  onPreBuild({ constants: { PUBLISH_DIR } }) {
    console.log(PUBLISH_DIR, resolve(PUBLISH_DIR) === resolve(CURRENT_DIR))
  },
}
