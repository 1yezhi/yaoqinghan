const { seedIfEmpty } = require('./services/invitation-store')

App({
  globalData: {
    appName: '邀请函',
    version: '0.1.0'
  },

  onLaunch() {
    seedIfEmpty()
  }
})
