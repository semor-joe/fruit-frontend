// Database interface definitions and operations
import { supabase } from './supabase'
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
    const { data: session, error } = await supabase.functions.invoke('wechat-login', {
      body: { code, userInfo }
    })

    if (error) throw error

    // Set session manually if the function returns one (access_token, refresh_token)
    if (session?.access_token) {
        const { error: setSessionError } = await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token
        })
        if (setSessionError) throw setSessionError
    }

    // Get user profile
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()
    
    if (userError) throw userError

    return { token: session.access_token, user }
  }

  async getUserInfo(userId: string): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (error) throw error
    return data
  }

  async updateUserInfo(userId: string, data: { nickname?: string, avatar_url?: string }): Promise<User> {
    const { data: user, error } = await supabase
      .from('users')
      .update(data)
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return user
  }

  // Land block operations
  async createLandBlock(data: Omit<LandBlock, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<LandBlock> {
    const { data: newBlock, error } = await supabase
      .from('land_blocks')
      .insert(data)
      .select()
      .single()

    if (error) throw error
    return newBlock
  }

  async getLandBlocks(userId: string): Promise<LandBlock[]> {
    const { data, error } = await supabase
      .from('land_blocks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async updateLandBlock(id: string, data: Partial<LandBlock>): Promise<LandBlock> {
    const { data: updated, error } = await supabase
      .from('land_blocks')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return updated
  }

  async deleteLandBlock(id: string): Promise<void> {
    const { error } = await supabase
      .from('land_blocks')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }

  // Fruit information operations
  // Note: Original API handled image uploads implicitly or separately? 
  // Here we just insert metadata.
  async createFruitInformation(data: Omit<FruitInformation, 'id' | 'created_at' | 'updated_at'>): Promise<FruitInformation> {
    const { data: newInfo, error } = await supabase
      .from('fruit_information')
      .insert(data)
      .select()
      .single()

    if (error) throw error
    return newInfo
  }

  async getFruitInformation(userId: string, limit?: number, offset?: number): Promise<FruitInformation[]> {
    let query = supabase
      .from('fruit_information')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (limit) query = query.limit(limit)
    if (offset) query = query.range(offset, offset + (limit || 10) - 1)

    const { data, error } = await query
    if (error) throw error
    return data || []
  }

  async updateFruitInformation(id: string, data: Partial<FruitInformation>): Promise<FruitInformation> {
    const { data: updated, error } = await supabase
      .from('fruit_information')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return updated
  }

  async deleteFruitInformation(id: string): Promise<void> {
    const { error } = await supabase
      .from('fruit_information')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }

  // Fertilizer operations
  async createFertilizer(data: Omit<Fertilizer, 'id' | 'created_at' | 'updated_at'>): Promise<Fertilizer> {
    const { data: newFert, error } = await supabase
      .from('fertilizers')
      .insert(data)
      .select()
      .single()

    if (error) throw error
    return newFert
  }

  async getFertilizers(): Promise<Fertilizer[]> {
    const { data, error } = await supabase
      .from('fertilizers')
      .select('*')
      .order('name')
    
    if (error) throw error
    return data || []
  }

  async updateFertilizer(id: string, data: Partial<Fertilizer>): Promise<Fertilizer> {
    const { data: updated, error } = await supabase
        .from('fertilizers')
        .update(data)
        .eq('id', id)
        .select()
        .single()
    if (error) throw error
    return updated
  }

  // Image operations
  async uploadImage(filePath: string): Promise<ImageData> {
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
    const fileContent = wx.getFileSystemManager().readFileSync(filePath)
    
    const { data, error } = await supabase.storage
      .from('images')
      .upload(fileName, fileContent, {
        contentType: 'image/jpeg'
      })

    if (error) throw error

    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(fileName)

    // Store metadata in images table
    const { data: imageRecord, error: dbError } = await supabase
      .from('images')
      .insert({
        image_url: publicUrl,
        user_id: (await supabase.auth.getUser()).data.user?.id
      })
      .select()
      .single()
      
    if (dbError) throw dbError

    // Map to ImageData interface
    return {
        id: imageRecord.id,
        url: imageRecord.image_url,
        created_at: new Date(imageRecord.created_at)
    }
  }

  async analyzeImage(imageId: string): Promise<ImageData> {
    // This is handled by Edge Function in the new architecture
    // Or we trigger it via database webhook
    // For now, let's call the 'analyze-image' function directly if needed
    // But original code expected a REST endpoint update.
    // We will leave this as a TODO or implementing an Edge Function call.
     const { data, error } = await supabase.functions.invoke('analyze-text', {
        body: { image_id: imageId } // Assuming analyze-text handles images too or we create analyze-image
     })
     if (error) throw error
     return data
  }

  // AI text analysis
  async analyzeText(text: string, landBlockId: string): Promise<any> {
    const { data, error } = await supabase.functions.invoke('analyze-text', {
        body: { text, land_block_id: landBlockId }
    })
    
    if (error) throw error
    return data
  }

  // Statistics
  async getStatistics(userId: string, dateRange?: { start: Date, end: Date }): Promise<any> {
    // This logic might be complex SQL. 
    // We can use a Postgres Function (RPC) for this.
    const { data, error } = await supabase
        .rpc('get_user_statistics', { 
            user_uuid: userId,
            start_date: dateRange?.start, 
            end_date: dateRange?.end 
        })
    
    if (error) throw error
    return data
  }
}

export const db = new DatabaseService();