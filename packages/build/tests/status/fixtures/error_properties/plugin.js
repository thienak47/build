export default {
  onBuild() {
    const error = new Error('test')
    error.test = true
    throw error
  },
}
