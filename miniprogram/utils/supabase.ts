
import { createClient } from 'supabase-wechat-stable'

// TODO: Replace with your actual Supabase project URL and anon key
const supabaseUrl = 'https://YOUR_PROJECT_ID.supabase.co'
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseKey)
