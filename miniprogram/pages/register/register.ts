import { db } from '../../utils/database';

Page({
  data: {
    invitationCode: '',
    nickname: '',
    loading: false,
    submitAttempted: false
  },

  onInputCode(e: any) {
    this.setData({ invitationCode: e.detail.value.trim() })
  },

  onInputNickname(e: any) {
    this.setData({ nickname: e.detail.value.trim() })
  },

  wxLogin(): Promise<WechatMiniprogram.LoginSuccessCallbackResult> {
    return new Promise((resolve, reject) => {
      wx.login({ success: resolve, fail: reject })
    })
  },

  async onRegister() {
    // Show validation errors
    this.setData({ submitAttempted: true })

    const { invitationCode, nickname } = this.data

    if (!nickname) {
      wx.showToast({ title: '请输入您的名字', icon: 'none' })
      return
    }

    if (!invitationCode) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    try {
      // Get a fresh wx login code
      const loginRes = await this.wxLogin()

      // Attempt registration with invitation code
      const loginData = await db.register(loginRes.code, invitationCode, nickname)

      // Store auth tokens
      wx.setStorageSync('token', loginData.token)
      wx.setStorageSync('supabase_token', loginData.token)
      wx.setStorageSync('userId', loginData.user.id)
      wx.setStorageSync('userInfo', {
        nickName: loginData.user.nickname || nickname,
        avatarUrl: loginData.user.avatar_url || ''
      })

      wx.showToast({ title: '注册成功', icon: 'success' })
      setTimeout(() => {
        wx.reLaunch({ url: '/pages/index/index' })
      }, 1500)

    } catch (error: any) {
      console.error('Registration failed:', error)
      this.setData({ loading: false })

      // Check if error is related to invalid invitation code
      let errorMessage = '请检查邀请码是否正确'
      if (error.message && (
        error.message.includes('invitation') || 
        error.message.includes('invalid') ||
        error.message.includes('邀请码')
      )) {
        errorMessage = '邀请码无效'
      } else if (error.message && (
        error.message.includes('row-level security') ||
        error.message.includes('RLS') ||
        error.message.includes('HTTP 403') ||
        error.message.includes('权限策略')
      )) {
        errorMessage = '注册失败：数据库权限策略未配置，请联系管理员执行 Supabase RLS 初始化 SQL'
      }

      wx.showModal({
        title: '注册失败',
        content: errorMessage,
        showCancel: false,
        confirmText: '确定'
      })
    }
  },

  onBack() {
    wx.navigateBack()
  }
})
