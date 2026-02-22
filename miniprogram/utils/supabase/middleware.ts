
// This file is not needed for WeChat Mini Program
// WeChat Mini Program doesn't use Next.js middleware

// If you need middleware functionality, implement it in your WeChat functions or Supabase Edge Functions
export const createClient = () => {
  throw new Error('Middleware is not supported in WeChat Mini Program. Use callSupabaseFunction or callSupabaseRest instead.')
}
