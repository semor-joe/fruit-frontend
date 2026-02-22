
// This file is not needed for WeChat Mini Program
// WeChat Mini Program uses wx.request instead of server-side Supabase client

// If you need server functionality, implement it as Supabase Edge Functions
export const createClient = () => {
  throw new Error('Server-side Supabase client is not supported in WeChat Mini Program. Use callSupabaseFunction or callSupabaseRest instead.')
}
