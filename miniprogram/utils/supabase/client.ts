// WeChat Mini Program Supabase Client
const SUPABASE_URL = 'https://etcxwmubkystbgzhsfwc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0Y3h3bXVia3lzdGJnemhzZndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzODg3OTgsImV4cCI6MjA4Njk2NDc5OH0.GbIf2x8WYjU4--lLEA-bt-sPsozV_vY_LcZ3annssWE' // Your anon key

export function callSupabaseFunction(functionName: string, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${SUPABASE_URL}/functions/v1/${functionName}`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      data,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else {
          reject(new Error(res.data?.error || res.data?.message || `HTTP ${res.statusCode}`))
        }
      },
      fail: reject
    })
  })
}

export function callSupabaseRest(table: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', data?: any, query?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ''}`
    
    // Get user JWT token from storage
    // Try 'supabase_token' first, fall back to 'token' key for compatibility
    const userToken = wx.getStorageSync('supabase_token') || wx.getStorageSync('token')
    
    // Validate token is a real JWT (must have 3 parts separated by '.')
    const isValidJwt = (t: string) => typeof t === 'string' && t.split('.').length === 3
    
    if (!isValidJwt(userToken)) {
      // No valid session - user must log in again
      reject(new Error('Not authenticated. Please log in.'))
      return
    }
    
    wx.request({
      url,
      method,
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
        'apikey': SUPABASE_ANON_KEY,
        'Prefer': (method === 'POST' || method === 'PATCH') ? 'return=representation' : 'return=minimal'
      },
      data: method !== 'GET' ? data : undefined,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.data?.message || 'Request failed'}`))
        }
      },
      fail: reject
    })
  })
}
