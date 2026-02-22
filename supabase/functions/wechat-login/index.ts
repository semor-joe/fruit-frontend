
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code, userInfo } = await req.json()
    if (!code) throw new Error('Missing code')

    // 1. Get WeChat Session
    const miniprogram_id = Deno.env.get('WECHAT_APP_ID')
    const miniprogram_secret = Deno.env.get('WECHAT_APP_SECRET')
    
    const wechatUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${miniprogram_id}&secret=${miniprogram_secret}&js_code=${code}&grant_type=authorization_code`
    const wechatResponse = await fetch(wechatUrl)
    const wechatData = await wechatResponse.json()

    if (wechatData.errcode) {
      throw new Error(`WeChat API Error: ${wechatData.errmsg}`)
    }

    const { openid, session_key } = wechatData

    // 2. Setup Supabase Admin Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 3. User Management
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
    const existingUser = users.find(u => u.user_metadata?.openid === openid)

    const email = `${openid}@wechat.com`
    // Deterministic password - always reset it to ensure it matches at sign-in
    const password = `wx_${openid}_${Deno.env.get('WECHAT_APP_ID')}`
    let userId: string

    if (existingUser) {
      userId = existingUser.id

      // Always update password so sign-in below always succeeds
      await supabase.auth.admin.updateUserById(userId, {
        password,
        user_metadata: { openid, ...userInfo }
      })
    } else {
      // Create new auth user
      const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { openid, ...userInfo }
      })
      if (createUserError) throw createUserError
      userId = newUser.user.id

      // Create user profile in public users table
      await supabase
        .from('users')
        .insert({
          id: userId,
          openid: openid,
          nickname: userInfo?.nickName || 'WeChat User',
          avatar_url: userInfo?.avatarUrl || ''
        })
    }

    // 4. Sign in with known password to get tokens
    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({ email, password })
    if (sessionError) throw sessionError

    // Return both session (with access_token) and user profile from our users table
    const userProfile = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    return new Response(
      JSON.stringify({
        ...sessionData.session,
        user: userProfile.data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
