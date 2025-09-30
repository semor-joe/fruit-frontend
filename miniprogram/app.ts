// app.ts
App<IAppOption>({
  globalData: {
    userInfo: undefined,
    isLoggedIn: false
  } as any,

  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 检查用户登录状态
    this.checkLoginStatus()
  },

  checkLoginStatus() {
    const token = wx.getStorageSync('token')
    const userInfo = wx.getStorageSync('userInfo')
    
    if (token && userInfo) {
      (this.globalData as any).isLoggedIn = true;
      (this.globalData as any).userInfo = userInfo;
    } else {
      // 清除可能存在的无效数据
      wx.clearStorageSync();
      (this.globalData as any).isLoggedIn = false;
      (this.globalData as any).userInfo = undefined;
      
      // 跳转到登录页面
      wx.reLaunch({
        url: '/pages/login/login'
      })
    }
  },

  onShow() {
    // 每次从后台切换到前台时检查登录状态
    this.checkLoginStatus()
  }
} as any)