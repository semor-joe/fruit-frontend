// Database interface definitions and operations
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
  private baseUrl = 'https://fruit.joekr.fun/api'; // Change this to your backend URL in production

  private async request(endpoint: string, options: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const token = wx.getStorageSync('token') || '';
      
      console.log(`Making ${options.method || 'GET'} request to: ${this.baseUrl}${endpoint}`);
      console.log('Request data:', options.data);
      console.log('Authorization token:', token ? 'present' : 'missing');
      
      wx.request({
        url: `${this.baseUrl}${endpoint}`,
        method: options.method || 'GET',
        data: options.data,
        header: {
          'content-type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.header
        },
        timeout: 10000, // 10 second timeout
        success: (response) => {
          console.log(`Response from ${endpoint}:`, {
            statusCode: response.statusCode,
            data: response.data,
            header: response.header
          });
          
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(response.data);
          } else {
            console.error(`Request failed with status ${response.statusCode}:`, response.data);
            reject(new Error(`Request failed with status ${response.statusCode}: ${JSON.stringify(response.data)}`));
          }
        },
        fail: (error) => {
          console.error('Database request error:', error);
          reject(new Error(`Request failed: ${error.errMsg || 'Network error'}`));
        }
      });
    });
  }

  // User operations
  async login(code: string, userInfo?: any): Promise<{token: string, user: User}> {
    return this.request('/auth/wechat-login', {
      method: 'POST',
      data: { code, userInfo }
    });
  }

  async getUserInfo(userId: string): Promise<User> {
    return this.request(`/users/${userId}`);
  }

  async updateUserInfo(userId: string, data: { nickname?: string, avatar_url?: string }): Promise<User> {
    return this.request(`/users/${userId}`, {
      method: 'PUT',
      data
    });
  }

  // Land block operations
  async createLandBlock(data: Omit<LandBlock, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<LandBlock> {
    const response = await this.request('/land-blocks', {
      method: 'POST',
      data
    });
    // Handle wrapped response format
    return response.data || response;
  }

  async getLandBlocks(userId: string): Promise<LandBlock[]> {
    const response = await this.request(`/land-blocks?user_id=${userId}`);
    // Handle both direct array response and wrapped response
    return response.data || response || [];
  }

  async updateLandBlock(id: string, data: Partial<LandBlock>): Promise<LandBlock> {
    const response = await this.request(`/land-blocks/${id}`, {
      method: 'PUT',
      data
    });
    // Handle wrapped response format
    return response.data || response;
  }

  async deleteLandBlock(id: string): Promise<void> {
    const response = await this.request(`/land-blocks/${id}`, {
      method: 'DELETE'
    });
    // Handle wrapped response format
    return response.data || response;
  }

  // Fruit information operations
  async createFruitInformation(data: Omit<FruitInformation, 'id' | 'created_at' | 'updated_at'>): Promise<FruitInformation> {
    return this.request('/fruit-information', {
      method: 'POST',
      data
    });
  }

  async getFruitInformation(userId: string, limit?: number, offset?: number): Promise<FruitInformation[]> {
    let url = `/fruit-information?user_id=${userId}`;
    if (limit) url += `&limit=${limit}`;
    if (offset) url += `&offset=${offset}`;
    return this.request(url);
  }

  async updateFruitInformation(id: string, data: Partial<FruitInformation>): Promise<FruitInformation> {
    return this.request(`/fruit-information/${id}`, {
      method: 'PUT',
      data
    });
  }

  async deleteFruitInformation(id: string): Promise<void> {
    return this.request(`/fruit-information/${id}`, {
      method: 'DELETE'
    });
  }

  // Fertilizer operations
  async createFertilizer(data: Omit<Fertilizer, 'id' | 'created_at' | 'updated_at'>): Promise<Fertilizer> {
    return this.request('/fertilizers', {
      method: 'POST',
      data
    });
  }

  async getFertilizers(): Promise<Fertilizer[]> {
    return this.request('/fertilizers');
  }

  async updateFertilizer(id: string, data: Partial<Fertilizer>): Promise<Fertilizer> {
    return this.request(`/fertilizers/${id}`, {
      method: 'PUT',
      data
    });
  }

  // Image operations
  async uploadImage(filePath: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${this.baseUrl}/images/upload`,
        filePath,
        name: 'image',
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token') || ''}`
        },
        success: (res) => {
          try {
            const data = JSON.parse(res.data);
            resolve(data);
          } catch (error) {
            reject(error);
          }
        },
        fail: reject
      });
    });
  }

  async analyzeImage(imageId: string): Promise<ImageData> {
    return this.request(`/images/${imageId}/analyze`, {
      method: 'POST'
    });
  }

  // AI text analysis
  async analyzeText(text: string, landBlockId: string): Promise<any> {
    return this.request('/ai/analyze-text', {
      method: 'POST',
      data: { text, land_block_id: landBlockId }
    });
  }

  // Statistics
  async getStatistics(userId: string, dateRange?: { start: Date, end: Date }): Promise<any> {
    let url = `/statistics?user_id=${userId}`;
    if (dateRange) {
      url += `&start=${dateRange.start.toISOString()}&end=${dateRange.end.toISOString()}`;
    }
    return this.request(url);
  }
}

export const db = new DatabaseService();