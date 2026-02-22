import { db } from '../../utils/database';

// Toggle this to control whether phone authorization is required during registration
const REQUIRE_PHONE_NUMBER = false

Page({
  data: {
    invitationCode: '',
    nickname: '',
    phoneNumber: '',
    maskedPhoneNumber: '',
    avatarUrl: '',
    loading: false,
    submitAttempted: false,
    profileAuthorized: false,
    phoneAuthorized: false,
    phoneRequired: REQUIRE_PHONE_NUMBER
  },

  onInputCode(e: any) {
    this.setData({ invitationCode: e.detail.value.trim() })
  },

  async onGetProfile() {
    try {
      const res = await new Promise<WechatMiniprogram.GetUserProfileSuccessCallbackResult>((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于注册账号并展示昵称',
          success: resolve,
          fail: reject
        })
      })

      const nickName = res.userInfo?.nickName || ''
      const avatarUrl = res.userInfo?.avatarUrl || ''
      this.setData({
        nickname: nickName,
        avatarUrl,
        profileAuthorized: !!nickName
      })
    } catch (error) {
      wx.showToast({ title: '请先授权获取昵称', icon: 'none' })
    }
  },

  async onGetPhoneNumber(e: any) {
    if (!e?.detail) return

    if (e.detail.errMsg && e.detail.errMsg.includes('deny')) {
      wx.showToast({ title: '请先授权获取手机号', icon: 'none' })
      return
    }

    try {
      const phoneCode = e.detail.code || ''
      if (!phoneCode) {
        wx.showToast({ title: '未获取到手机号凭证，请重试', icon: 'none' })
        return
      }

      const phoneNumber = await db.getWechatPhoneNumber(phoneCode)

      if (!phoneNumber) {
        wx.showToast({ title: '获取手机号失败，请重试', icon: 'none' })
        return
      }

      this.setData({
        phoneNumber,
        maskedPhoneNumber: this.maskPhoneNumber(phoneNumber),
        phoneAuthorized: true
      })
    } catch (error) {
      console.error('Get phone number failed:', error)
      wx.showToast({ title: '获取手机号失败，请重试', icon: 'none' })
    }
  },

  wxLogin(): Promise<WechatMiniprogram.LoginSuccessCallbackResult> {
    return new Promise((resolve, reject) => {
      wx.login({ success: resolve, fail: reject })
    })
  },

  maskPhoneNumber(phone: string): string {
    if (!phone || phone.length < 7) return phone || ''
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`
  },

  async onRegister() {
    // Show validation errors
    this.setData({ submitAttempted: true })

    const { invitationCode, nickname, phoneNumber, avatarUrl } = this.data

    if (!nickname) {
      wx.showToast({ title: '请先授权获取昵称', icon: 'none' })
      return
    }

    if (this.data.phoneRequired && !phoneNumber) {
      wx.showToast({ title: '请先授权获取手机号', icon: 'none' })
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
      const loginData = await db.register(loginRes.code, invitationCode, nickname, phoneNumber, avatarUrl)

      // Store auth tokens
      wx.setStorageSync('token', loginData.token)
      wx.setStorageSync('supabase_token', loginData.token)
      wx.setStorageSync('userId', loginData.user.id)
      wx.setStorageSync('userInfo', {
        nickName: nickname,
        avatarUrl: avatarUrl || loginData.user.avatar_url || ''
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
      }

      if (error.message && (
        error.message.includes('达到使用上限') ||
        error.message.includes('max_uses') ||
        error.message.includes('use_count') ||
        error.message.includes('使用次数异常')
      )) {
        errorMessage = '邀请码已达到使用上限'
      } else if (error.message && (
        error.message.includes('已过期') ||
        error.message.includes('expires')
      )) {
        errorMessage = '邀请码已过期'
      } else if (error.message && (
        error.message.includes('已失效') ||
        error.message.includes('inactive')
      )) {
        errorMessage = '邀请码已失效'
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
