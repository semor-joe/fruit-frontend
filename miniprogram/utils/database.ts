// Database interface definitions and operations
import { callSupabaseFunction, callSupabaseRest } from './supabase/client'

/** Decode the payload section of a JWT without any crypto verification */
function decodeJwtPayload(token: string): any {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
    let bytes = ''
    for (let i = 0; i < padded.length; i += 4) {
      const b0 = chars.indexOf(padded[i])
      const b1 = chars.indexOf(padded[i + 1])
      const b2 = chars.indexOf(padded[i + 2])
      const b3 = chars.indexOf(padded[i + 3])
      bytes += String.fromCharCode((b0 << 2) | (b1 >> 4))
      if (padded[i + 2] !== '=') bytes += String.fromCharCode(((b1 & 15) << 4) | (b2 >> 2))
      if (padded[i + 3] !== '=') bytes += String.fromCharCode(((b2 & 3) << 6) | b3)
    }
    return JSON.parse(decodeURIComponent(escape(bytes)))
  } catch (e) {
    console.error('JWT decode failed:', e)
    return null
  }
}

export interface User {
  id: string;
  openid: string;
  nickname: string;
  avatar_url?: string;
  phone_number?: string;
  created_at: Date;
  updated_at: Date;
}

export interface LandBlock {
  id: string;
  user_id: string;
  name: string;
  location?: string;
  area?: number;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export interface FruitInformation {
  id: string;
  land_block_id: string;
  session_id: string;
  img_url?: string;
  fertilizer_ids: string[];
  content: string; // Original input text
  extracted_data?: any; // AI extracted data
  created_at: Date;
  updated_at: Date;
}

export interface Fertilizer {
  id: string;
  name: string;
  amount: number;
  unit: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ImageData {
  id: string;
  url: string;
  content?: string; // AI analysis result
  file_path?: string;
  created_at: Date;
}

/** Upsert a row in the public users table so foreign key constraints are satisfied.
 *  Returns the confirmed row from the database. */
async function ensureUserRow(user: Partial<User>): Promise<User> {
  try {
    const existing = await callSupabaseRest('users', 'GET', undefined, `id=eq.${user.id}&select=*`)
    if (existing && existing.length > 0) {
      console.log('[DB] User row already exists:', existing[0])
      return existing[0]
    }
    // Row does not exist — insert it
    const created = await callSupabaseRest('users', 'POST', {
      id: user.id,
      openid: user.openid || '',
      nickname: user.nickname || '',
      avatar_url: user.avatar_url || ''
    }, 'select=*')
    if (!created || created.length === 0) {
      throw new Error('Insert returned no data')
    }
    console.log('[DB] User row created successfully:', created[0])
    return created[0]
  } catch (e) {
    console.error('[DB] ensureUserRow failed:', e)
    const message = (e as any)?.message || ''
    if (message.includes('row-level security') || message.includes('RLS') || message.includes('HTTP 403')) {
      throw new Error('数据库权限策略未配置：请在 Supabase 为 users 表添加 INSERT policy')
    }
    throw new Error('Failed to create user profile. Please try again.')
  }
}

// Database operations class
class DatabaseService {
  
  // User operations
  async login(code: string, userInfo?: any): Promise<{token: string, user: User} | {is_new_user: true}> {
    // Call Supabase Edge Function for WeChat Login
    // Returns {is_new_user: true} if the WeChat account has never registered before
    const result = await callSupabaseFunction('wechat-login', {
      code,
      userInfo: userInfo ? {
        nickName: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl
      } : undefined
    })

    console.log('Edge function result:', result)

    // Explicit new-user signal from updated edge function
    if (result && result.is_new_user) {
      return { is_new_user: true }
    }

    // Extract token and user — works for both the current and older edge function responses
    const token = result.access_token || result.session?.access_token

    if (!token) {
      console.log('No token in response — treating as new user')
      return { is_new_user: true }
    }

    let user = result.user || result.session?.user

    // Edge function may return user: null — decode from JWT payload instead
    if (!user) {
      const jwtPayload = decodeJwtPayload(token)
      if (!jwtPayload?.sub) {
        console.log('No user data in response — treating as new user')
        return { is_new_user: true }
      }
      user = {
        id: jwtPayload.sub,
        nickname: jwtPayload.user_metadata?.nickName || '',
        openid: jwtPayload.user_metadata?.openid || '',
        avatar_url: jwtPayload.user_metadata?.avatarUrl || '',
        created_at: new Date(),
        updated_at: new Date()
      } as User
    }

    // Store session in WeChat storage
    wx.setStorageSync('supabase_token', token)
    wx.setStorageSync('supabase_user', user)
    wx.setStorageSync('userId', user.id)

    // Ensure the public users table row exists (required for FK constraints)
    // Non-fatal on login — row likely already exists; RLS may block re-insert
    try {
      const confirmedUser = await ensureUserRow(user)
      wx.setStorageSync('supabase_user', confirmedUser)
      return { token, user: confirmedUser }
    } catch (e) {
      console.warn('[DB] ensureUserRow skipped on login (row likely exists):', e)
      return { token, user }
    }
  }

  // Registration with invitation code (new users only)
  async register(code: string, invitationCode: string, nickname?: string): Promise<{token: string, user: User}> {
    const result = await callSupabaseFunction('wechat-login', {
      code,
      invitationCode,
      userInfo: nickname ? { nickName: nickname } : undefined
    })

    if (result && result.is_new_user === true) {
      throw new Error('邀请码验证失败，请检查后重试')
    }

    const token = result.access_token || result.session?.access_token
    if (!token) throw new Error('No access token received from server')

    // Try all possible locations where user data might be nested
    let user = result.user || result.session?.user || result.data?.user || result.data?.session?.user

    if (!user) {
      // Server returned null user — decode it from the JWT payload instead
      const jwtPayload = decodeJwtPayload(token)
      if (!jwtPayload?.sub) throw new Error('No user data received from server')
      user = {
        id: jwtPayload.sub,
        nickname: jwtPayload.user_metadata?.nickName || nickname || '',
        openid: jwtPayload.user_metadata?.openid || '',
        avatar_url: jwtPayload.user_metadata?.avatarUrl || '',
        created_at: new Date(),
        updated_at: new Date()
      } as User
    }

    wx.setStorageSync('supabase_token', token)
    wx.setStorageSync('supabase_user', user)
    wx.setStorageSync('userId', user.id)

    // Ensure the public users table row exists (required for FK constraints)
    // and verify it was persisted by reading back the confirmed row
    const confirmedUser = await ensureUserRow(user)
    console.log('[DB] Registration complete — confirmed user in DB:', confirmedUser)

    // Update stored user with the confirmed DB row (may have extra fields like created_at)
    wx.setStorageSync('supabase_user', confirmedUser)

    return { token, user: confirmedUser }
  }

  async getUserInfo(userId: string): Promise<User> {
    const data = await callSupabaseRest('users', 'GET', undefined, `id=eq.${userId}&select=*`)
    if (!data || data.length === 0) throw new Error('User not found')
    return data[0]
  }

  async updateUserInfo(userId: string, updateData: { nickname?: string, avatar_url?: string, phone_number?: string }): Promise<User> {
    const result = await callSupabaseRest('users', 'PATCH', updateData, `id=eq.${userId}&select=*`)
    if (!result || result.length === 0) throw new Error('Failed to update user')
    return result[0]
  }

  // Land block operations
  async createLandBlock(data: Omit<LandBlock, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<LandBlock> {
    // Get the current user ID from storage
    const userId = wx.getStorageSync('userId') || wx.getStorageSync('supabase_user')?.id
    if (!userId) {
      throw new Error('User not authenticated. Please log in again.')
    }
    
    const landBlockData = {
      ...data,
      user_id: userId
    }
    
    const result = await callSupabaseRest('land_blocks', 'POST', landBlockData, 'select=*')
    if (!result || result.length === 0) throw new Error('Failed to create land block')
    return result[0]
  }

  async getLandBlocks(userId: string): Promise<LandBlock[]> {
    const data = await callSupabaseRest('land_blocks', 'GET', undefined, `user_id=eq.${userId}&select=*&order=created_at.desc`)
    return data || []
  }

  async updateLandBlock(id: string, updateData: Partial<LandBlock>): Promise<LandBlock> {
    const result = await callSupabaseRest('land_blocks', 'PATCH', updateData, `id=eq.${id}&select=*`)
    if (!result || result.length === 0) throw new Error('Failed to update land block')
    return result[0]
  }

  async deleteLandBlock(id: string): Promise<void> {
    // Delete associated fruit_information records first (foreign key constraint)
    await callSupabaseRest('fruit_information', 'DELETE', undefined, `land_block_id=eq.${id}`)
    await callSupabaseRest('land_blocks', 'DELETE', undefined, `id=eq.${id}`)
  }

  // Fruit information operations
  async createFruitInformation(data: Omit<FruitInformation, 'id' | 'created_at' | 'updated_at'>): Promise<FruitInformation> {
    const userId = wx.getStorageSync('userId') || wx.getStorageSync('supabase_user')?.id
    if (!userId) throw new Error('User not authenticated. Please log in again.')

    const result = await callSupabaseRest('fruit_information', 'POST', { ...data, user_id: userId }, 'select=*')
    if (!result || result.length === 0) throw new Error('Failed to create fruit information')
    return result[0]
  }

  async getFruitInformation(userId: string, limit?: number, offset?: number): Promise<FruitInformation[]> {
    let queryParams = `user_id=eq.${userId}&select=*&order=created_at.desc`
    
    if (limit) queryParams += `&limit=${limit}`
    if (offset) queryParams += `&offset=${offset}`

    const data = await callSupabaseRest('fruit_information', 'GET', undefined, queryParams)
    return data || []
  }

  async findContentById(userId: string, id: string): Promise<FruitInformation | null> {
    // Try direct query by id first
    const data = await callSupabaseRest('fruit_information', 'GET', undefined, `id=eq.${id}&user_id=eq.${userId}&select=*`)
    if (data && data.length > 0) return data[0]
    return null
  }

  async getAllFruitInformation(userId: string): Promise<FruitInformation[]> {
    const data = await callSupabaseRest('fruit_information', 'GET', undefined, `user_id=eq.${userId}&select=*&order=created_at.desc`)
    return data || []
  }

  async updateFruitInformation(id: string, updateData: Partial<FruitInformation>): Promise<FruitInformation> {
    const result = await callSupabaseRest('fruit_information', 'PATCH', updateData, `id=eq.${id}&select=*`)
    if (!result || result.length === 0) throw new Error('Failed to update fruit information')
    return result[0]
  }

  async deleteFruitInformation(id: string): Promise<void> {
    await callSupabaseRest('fruit_information', 'DELETE', undefined, `id=eq.${id}`)
  }

  // Fertilizer operations
  async createFertilizer(data: Omit<Fertilizer, 'id' | 'created_at' | 'updated_at'>): Promise<Fertilizer> {
    const userId = wx.getStorageSync('userId') || wx.getStorageSync('supabase_user')?.id
    if (!userId) throw new Error('User not authenticated. Please log in again.')

    const result = await callSupabaseRest('fertilizers', 'POST', { ...data, user_id: userId }, 'select=*')
    if (!result || result.length === 0) throw new Error('Failed to create fertilizer')
    return result[0]
  }

  async getFertilizers(): Promise<Fertilizer[]> {
    const data = await callSupabaseRest('fertilizers', 'GET', undefined, 'select=*&order=name')
    return data || []
  }

  async updateFertilizer(id: string, updateData: Partial<Fertilizer>): Promise<Fertilizer> {
    const result = await callSupabaseRest('fertilizers', 'PATCH', updateData, `id=eq.${id}&select=*`)
    if (!result || result.length === 0) throw new Error('Failed to update fertilizer')
    return result[0]
  }

  // Image operations
  async uploadImage(filePath: string): Promise<ImageData> {
    const SUPABASE_URL = 'https://etcxwmubkystbgzhsfwc.supabase.co'
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0Y3h3bXVia3lzdGJnemhzZndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzODg3OTgsImV4cCI6MjA4Njk2NDc5OH0.GbIf2x8WYjU4--lLEA-bt-sPsozV_vY_LcZ3annssWE'
    const token = wx.getStorageSync('supabase_token') || wx.getStorageSync('token')
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
    const bucket = 'images'

    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${SUPABASE_URL}/storage/v1/object/${bucket}/${fileName}`,
        filePath,
        name: 'file',
        header: {
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY,
          'x-upsert': 'true'
        },
        success: (res) => {
          try {
            const data = JSON.parse(res.data)
            if (res.statusCode === 200 || res.statusCode === 201) {
              const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${fileName}`
              resolve({
                id: fileName,
                url: publicUrl,
                created_at: new Date()
              })
            } else {
              reject(new Error(data.error || data.message || `Upload failed with status ${res.statusCode}`))
            }
          } catch (e) {
            reject(new Error('Failed to parse upload response'))
          }
        },
        fail: (err) => {
          reject(err)
        }
      })
    })
  }

  async analyzeImage(imageId: string): Promise<ImageData> {
    // Call the 'analyze-text' function for image analysis  
    const data = await callSupabaseFunction('analyze-text', {
      image_id: imageId
    })
    return data
  }

  // AI text analysis
  async analyzeText(text: string, landBlockId: string): Promise<any> {
    const data = await callSupabaseFunction('analyze-text', {
      text, 
      land_block_id: landBlockId
    })
    return data
  }

  // Statistics
  async getStatistics(userId: string, dateRange?: { start: Date, end: Date }): Promise<any> {
    // Compute statistics from available REST data
    const [allContent, landBlocks] = await Promise.all([
      this.getAllFruitInformation(userId),
      this.getLandBlocks(userId)
    ])

    // Filter by date range
    const filtered = dateRange ? allContent.filter((item: any) => {
      const d = new Date(item.created_at)
      return d >= dateRange.start && d <= dateRange.end
    }) : allContent

    // Count images
    const totalImages = filtered.filter((item: any) => item.img_url || item.image_url).length

    // Aggregate fertilizers per land block
    const landBlockMap: Record<string, any> = {}
    landBlocks.forEach((lb: any) => {
      landBlockMap[lb.id] = { id: lb.id, name: lb.name, recordCount: 0 }
    })
    filtered.forEach((item: any) => {
      if (item.land_block_id && landBlockMap[item.land_block_id]) {
        landBlockMap[item.land_block_id].recordCount++
      }
    })

    // Aggregate fertilizer usage
    const fertilizerMap: Record<string, any> = {}
    filtered.forEach((item: any) => {
      const ferts: any[] = item.extracted_data?.fertilizers || item.ai_analysis?.fertilizers || item.fertilizer_recommendations || []
      ferts.forEach((f: any) => {
        const name = f.name || f.fertilizer_name || '未知'
        if (!fertilizerMap[name]) fertilizerMap[name] = { name, totalAmount: 0, count: 0 }
        fertilizerMap[name].totalAmount += parseFloat(f.amount || f.quantity || 0) || 0
        fertilizerMap[name].count++
      })
    })

    return {
      totalRecords: filtered.length,
      totalLandBlocks: landBlocks.length,
      totalImages,
      totalFertilizers: Object.keys(fertilizerMap).length,
      landBlocks: Object.values(landBlockMap),
      fertilizers: Object.values(fertilizerMap),
      recentActivity: filtered.slice(0, 10).map((item: any) => ({
        id: item.id,
        title: item.content || item.description || '记录',
        createdAt: item.created_at
      }))
    }
  }
}

export const db = new DatabaseService();