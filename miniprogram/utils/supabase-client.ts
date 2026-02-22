// WeChat Mini Program Supabase client
import { callSupabaseFunction, callSupabaseRest } from './supabase/client'

// Re-export for backwards compatibility
export { callSupabaseFunction, callSupabaseRest } from './supabase/client'

// Simple storage for user session in WeChat Mini Program
class SimpleAuth {
  private token: string = ''
  private user: any = null
  
  setSession(sessionData: { access_token: string; user: any }) {
    this.token = sessionData.access_token
    this.user = sessionData.user
    // Store in WeChat storage
    wx.setStorageSync('supabase_token', sessionData.access_token)
    wx.setStorageSync('supabase_user', sessionData.user)
  }
  
  getSession() {
    if (!this.token) {
      this.token = wx.getStorageSync('supabase_token') || ''
      this.user = wx.getStorageSync('supabase_user') || null
    }
    return { access_token: this.token, user: this.user }
  }
  
  clearSession() {
    this.token = ''
    this.user = null
    wx.removeStorageSync('supabase_token')
    wx.removeStorageSync('supabase_user')
  }
}

// Simple client for backwards compatibility
export const supabase = {
  auth: new SimpleAuth(),
  functions: {
    invoke: (functionName: string, options: any) => 
      callSupabaseFunction(functionName, options.body || options)
  },
  from: (table: string) => ({
    select: (columns: string = '*') => ({
      eq: (column: string, value: any) => ({
        single: () => callSupabaseRest(table, 'GET', undefined, `${column}=eq.${value}&select=${columns}`),
        limit: (count: number) => callSupabaseRest(table, 'GET', undefined, `${column}=eq.${value}&select=${columns}&limit=${count}`)
      }),
      order: (column: string, options: any) => ({
        limit: (count: number) => callSupabaseRest(table, 'GET', undefined, `select=${columns}&order=${column}.${options.ascending ? 'asc' : 'desc'}&limit=${count}`)
      })
    }),
    insert: (data: any) => ({
      select: () => ({
        single: () => callSupabaseRest(table, 'POST', data, 'select=*')
      })
    }),
    update: (data: any) => ({
      eq: (column: string, value: any) => ({
        select: () => ({
          single: () => callSupabaseRest(table, 'PUT', data, `${column}=eq.${value}&select=*`)
        })
      })
    }),
    delete: () => ({
      eq: (column: string, value: any) => 
        callSupabaseRest(table, 'DELETE', undefined, `${column}=eq.${value}`)
    })
  })
}