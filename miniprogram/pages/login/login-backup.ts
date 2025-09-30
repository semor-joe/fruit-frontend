import { db } from '../../utils/database';

Page({
  data: {
    hasUserInfo: false,
    userInfo: {
      avatarUrl: '',
      nickName: ''
    },
    loading: false,
    canIUseGetUserProfile: wx.canIUse('getUserProfile'),
    canIUseNicknameComp: wx.canIUse('input.type.nickname')
  },

  onLoad() {
    // Check if user is already logged in
    const userInfo = wx.getStorageSync('userInfo');
    const token = wx.getStorageSync('token');
    
    if (userInfo && token) {
      this.setData({
        hasUserInfo: true,
        userInfo
      });
    } else {
      // Auto login with wx.login() only (no user info required initially)
      this.performWxLogin();
    }
  },

  // Demo mode for testing without backend
  useDemoMode(wxCode?: string) {
    console.log('Using demo mode with WeChat code:', wxCode);
    
    // Generate demo user data
    const demoUser = {
      id: `demo_user_${Date.now()}`,
      openid: wxCode || `demo_openid_${Date.now()}`,
      nickname: '演示用户',
      avatar_url: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
    };
    
    const demoToken = `demo_token_${Date.now()}`;
    
    // Store demo data
    wx.setStorageSync('token', demoToken);
    wx.setStorageSync('userId', demoUser.id);
    wx.setStorageSync('userInfo', {
      nickName: demoUser.nickname,
      avatarUrl: demoUser.avatar_url
    });
    
    this.setData({
      hasUserInfo: true,
      userInfo: {
        nickName: demoUser.nickname,
        avatarUrl: demoUser.avatar_url
      },
      loading: false
    });
    
    wx.showToast({
      title: '演示模式登录成功',
      icon: 'success'
    });
    
    // Auto redirect to main app
    setTimeout(() => {
      this.enterApp();
    }, 1500);
  },

  // Modern WeChat Login Flow
  async performWxLogin() {
    this.setData({ loading: true });

    try {
      // Step 1: Get login code from WeChat
      const loginRes = await this.wxLogin();
      console.log('WeChat login code:', loginRes.code);

      // Step 2: Send code to backend for authentication
      const loginData = await db.login(loginRes.code);
      console.log('Backend login response:', loginData);
      
      // Validate response structure
      if (!loginData || typeof loginData !== 'object') {
        throw new Error('Invalid response from server');
      }
      
      if (!loginData.token) {
        throw new Error('No token received from server');
      }
      
      if (!loginData.user || !loginData.user.id) {
        throw new Error('Invalid user data received from server');
      }
      
      // Step 3: Store authentication data
      wx.setStorageSync('token', loginData.token);
      wx.setStorageSync('userId', loginData.user.id);
      
      // Update user info if available from backend
      if (loginData.user.nickname && loginData.user.avatar_url) {
        const userInfo = {
          nickName: loginData.user.nickname,
          avatarUrl: loginData.user.avatar_url
        };
        wx.setStorageSync('userInfo', userInfo);
        this.setData({
          hasUserInfo: true,
          userInfo: userInfo
        });
      }

      this.setData({ loading: false });

      wx.showToast({
        title: '登录成功',
        icon: 'success'
      });

      // Auto redirect to main app after successful login
      setTimeout(() => {
        this.enterApp();
      }, 1500);

    } catch (error: any) {
      console.error('WeChat login failed:', error);
      this.setData({ loading: false });
      
      // Check if it's a backend connection error
      if (error.message && (error.message.includes('Request failed') || error.message.includes('网络'))) {
        // Backend not available - use demo mode
        console.log('Backend not available, using demo mode');
        this.useDemoMode(loginRes?.code);
        return;
      }
      
      wx.showModal({
        title: '登录失败',
        content: `登录出错: ${error.message || '未知错误'}`,
        showCancel: true,
        cancelText: '使用演示模式',
        confirmText: '重试',
        success: (res) => {
          if (res.confirm) {
            this.performWxLogin();
          } else {
            // Use demo mode if user chooses
            this.useDemoMode();
          }
        }
      });
    }     avatarUrl: '',
      nickName: ''
    },
    loading: false,
    canIUseGetUserProfile: wx.canIUse('getUserProfile'),
    canIUseNicknameComp: wx.canIUse('input.type.nickname')
  },

  onLoad() {
    // Check if user is already logged in
    const userInfo = wx.getStorageSync('userInfo');
    const token = wx.getStorageSync('token');
    
    if (userInfo && token) {
      this.setData({
        hasUserInfo: true,
        userInfo
      });
    } else {
      // Auto login with wx.login() only (no user info required initially)
      this.performWxLogin();
    }
  },

  // Modern WeChat Login Flow
  async performWxLogin() {
    this.setData({ loading: true });

    try {
      // Step 1: Get login code from WeChat
      const loginRes = await this.wxLogin();
      console.log('WeChat login code:', loginRes.code);

      // Step 2: Send code to backend for authentication
      const loginData = await db.login(loginRes.code);
      console.log('Backend login response:', loginData);
      
      // Validate response structure
      if (!loginData || typeof loginData !== 'object') {
        throw new Error('Invalid response from server');
      }
      
      if (!loginData.token) {
        throw new Error('No token received from server');
      }
      
      if (!loginData.user || !loginData.user.id) {
        throw new Error('Invalid user data received from server');
      }
      
      // Step 3: Store authentication data
      wx.setStorageSync('token', loginData.token);
      wx.setStorageSync('userId', loginData.user.id);
      
      // Update user info if available from backend
      if (loginData.user.nickname && loginData.user.avatar_url) {
        const userInfo = {
          nickName: loginData.user.nickname,
          avatarUrl: loginData.user.avatar_url
        };
        wx.setStorageSync('userInfo', userInfo);
        this.setData({
          hasUserInfo: true,
          userInfo: userInfo
        });
      }

      this.setData({ loading: false });

      wx.showToast({
        title: '登录成功',
        icon: 'success'
      });

      // Auto redirect to main app after successful login
      setTimeout(() => {
        this.enterApp();
      }, 1500);

    } catch (error) {
      console.error('WeChat login failed:', error);
      this.setData({ loading: false });
      
      wx.showModal({
        title: '登录失败',
        content: '无法连接到服务器，请检查网络连接后重试',
        showCancel: true,
        cancelText: '退出',
        confirmText: '重试',
        success: (res) => {
          if (res.confirm) {
            this.performWxLogin();
          }
        }
      });
    }
  },

  // Get user profile using modern API
  async getUserProfile() {
    if (!wx.getUserProfile) {
      wx.showToast({
        title: '当前版本不支持',
        icon: 'error'
      });
      return;
    }

    this.setData({ loading: true });

    try {
      const res = await this.wxGetUserProfile();
      const userInfo = res.userInfo;

      // Update user profile in backend
      await this.updateUserProfile(userInfo);

      // Store locally
      wx.setStorageSync('userInfo', userInfo);
      this.setData({
        hasUserInfo: true,
        userInfo: userInfo,
        loading: false
      });

      wx.showToast({
        title: '资料更新成功',
        icon: 'success'
      });

    } catch (error: any) {
      console.error('Get user profile failed:', error);
      this.setData({ loading: false });
      
      if (error?.errMsg && error.errMsg.includes('cancel')) {
        wx.showToast({
          title: '用户取消授权',
          icon: 'none'
        });
      }
    }
  },

  // Handle avatar selection (new WeChat feature)
  async onChooseAvatar(e: any) {
    const { avatarUrl } = e.detail;
    
    try {
      // Upload avatar to your server here if needed
      const userInfo = { ...this.data.userInfo, avatarUrl };
      
      await this.updateUserProfile(userInfo);
      
      wx.setStorageSync('userInfo', userInfo);
      this.setData({ 
        userInfo,
        hasUserInfo: !!userInfo.nickName && !!avatarUrl
      });

    } catch (error) {
      console.error('Update avatar failed:', error);
    }
  },

  // Handle nickname input (new WeChat feature)
  async onNicknameInput(e: any) {
    const nickName = e.detail.value;
    
    try {
      const userInfo = { ...this.data.userInfo, nickName };
      
      await this.updateUserProfile(userInfo);
      
      wx.setStorageSync('userInfo', userInfo);
      this.setData({ 
        userInfo,
        hasUserInfo: !!nickName && !!userInfo.avatarUrl
      });

    } catch (error) {
      console.error('Update nickname failed:', error);
    }
  },

  // Helper Methods
  wxLogin(): Promise<WechatMiniprogram.LoginSuccessCallbackResult> {
    return new Promise((resolve, reject) => {
      wx.login({
        success: resolve,
        fail: reject
      });
    });
  },

  wxGetUserProfile(): Promise<WechatMiniprogram.GetUserProfileSuccessCallbackResult> {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: resolve,
        fail: reject
      });
    });
  },

  async updateUserProfile(userInfo: any) {
    try {
      const userId = wx.getStorageSync('userId');
      if (!userId) {
        throw new Error('User not logged in');
      }

      // Update user profile in backend
      await db.updateUserInfo(userId, {
        nickname: userInfo.nickName,
        avatar_url: userInfo.avatarUrl
      });

    } catch (error) {
      console.error('Update user profile failed:', error);
      throw error;
    }
  },

  // Quick login without user info (just wx.login)
  async quickLogin() {
    this.performWxLogin();
  },

  // Force logout
  logout() {
    wx.clearStorageSync();
    this.setData({
      hasUserInfo: false,
      userInfo: {
        avatarUrl: '',
        nickName: ''
      }
    });
    
    wx.showToast({
      title: '已退出登录',
      icon: 'success'
    });
  },

  enterApp() {
    wx.switchTab({
      url: '/pages/add-content/add-content'
    });
  },

  onShow() {
    // Hide tab bar on login page
    wx.hideTabBar({});
  }
});