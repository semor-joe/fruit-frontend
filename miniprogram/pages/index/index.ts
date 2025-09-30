// index.ts
// 获取应用实例
const app = getApp<IAppOption>()

Page({
  data: {
    loading: true
  },

  onLoad() {
    // Check login status and redirect accordingly
    this.checkAndRedirect()
  },

  checkAndRedirect() {
    const token = wx.getStorageSync('token')
    const userId = wx.getStorageSync('userId')
    
    if (!token || !userId) {
      // Not logged in, redirect to login
      wx.reLaunch({
        url: '/pages/login/login'
      })
    } else {
      // Already logged in, redirect to main app
      wx.switchTab({
        url: '/pages/add-content/add-content'
      })
    }
  }
})
