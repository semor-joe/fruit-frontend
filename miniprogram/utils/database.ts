// Database interface definitions and operations
import { callSupabaseFunction, callSupabaseRest } from './supabase/client'
export interface User {
  id: string;
  openid: string;
  nickname: string;
  avatar_url?: string;
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

// Database operations class
class DatabaseService {
  
  // User operations  
  async login(code: string, userInfo?: any): Promise<{token: string, user: User}> {
    // Call Supabase Edge Function for WeChat Login
    // According to WeChat docs: send code to server, server calls code2Session to get openid/session_key
    const result = await callSupabaseFunction('wechat-login', { 
      code, 
      userInfo: userInfo ? {
        nickName: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl
      } : undefined
    })

    console.log('Edge function result:', result)

    // Edge function returns sessionData.session + user separately
    // session has: access_token, refresh_token, token_type, expires_in
    // user comes from: sessionData.user (passed separately) or result.user
    const token = result.access_token || result.session?.access_token
    const user = result.user || result.session?.user
    
    if (!token) {
      throw new Error('No access token received from server')
    }
    
    if (!user) {
      throw new Error('No user data received from server')
    }

    // Store session in WeChat storage
    wx.setStorageSync('supabase_token', token)
    wx.setStorageSync('supabase_user', user)

    return { token, user }
  }

  async getUserInfo(userId: string): Promise<User> {
    const data = await callSupabaseRest('users', 'GET', undefined, `id=eq.${userId}&select=*`)
    if (!data || data.length === 0) throw new Error('User not found')
    return data[0]
  }

  async updateUserInfo(userId: string, updateData: { nickname?: string, avatar_url?: string }): Promise<User> {
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