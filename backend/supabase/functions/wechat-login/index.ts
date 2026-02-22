
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
    const body = await req.json()
    const { action } = body

    if (action === 'get_phone_number') {
      const { phoneCode } = body
      if (!phoneCode) throw new Error('Missing phoneCode')

      const miniprogram_id = Deno.env.get('WECHAT_APP_ID')
      const miniprogram_secret = Deno.env.get('WECHAT_APP_SECRET')

      const accessTokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${miniprogram_id}&secret=${miniprogram_secret}`
      const accessTokenResp = await fetch(accessTokenUrl)
      const accessTokenData = await accessTokenResp.json()
      if (accessTokenData.errcode || !accessTokenData.access_token) {
        throw new Error(`WeChat token error: ${accessTokenData.errmsg || 'failed to get access token'}`)
      }

      const phoneUrl = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessTokenData.access_token}`
      const phoneResp = await fetch(phoneUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: phoneCode })
      })
      const phoneData = await phoneResp.json()
      if (phoneData.errcode) {
        throw new Error(`WeChat phone error: ${phoneData.errmsg}`)
      }

      return new Response(
        JSON.stringify({
          phoneNumber: phoneData?.phone_info?.phoneNumber || '',
          purePhoneNumber: phoneData?.phone_info?.purePhoneNumber || ''
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'check_invitation') {
      const invitationCode = (body?.invitationCode || '').trim()
      if (!invitationCode) throw new Error('请输入邀请码')

      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      const { data: invitation, error: invitationError } = await supabase
        .from('invitation_codes')
        .select('*')
        .eq('code', invitationCode)
        .single()

      if (invitationError || !invitation) throw new Error('邀请码无效')
      if (!invitation.is_active) throw new Error('邀请码已失效')
      if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) throw new Error('邀请码已过期')
      if (invitation.use_count >= invitation.max_uses) throw new Error('邀请码已达到使用上限')

      return new Response(
        JSON.stringify({
          valid: true,
          code: invitation.code,
          use_count: invitation.use_count,
          max_uses: invitation.max_uses,
          remaining_uses: invitation.max_uses - invitation.use_count
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { code, userInfo } = body
    const invitationCode = (body?.invitationCode || '').trim()
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

    const { openid } = wechatData

    // 2. Setup Supabase Admin Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 3. User Management
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
    if (listError) throw listError
    const existingUser = users.find((u: any) => u.user_metadata?.openid === openid)

    const { data: existingProfile } = await supabase
      .from('users')
      .select('*')
      .eq('openid', openid)
      .maybeSingle()

    const isRegistered = !!existingProfile

    const email = `${openid}@wechat.com`
    const password = `wx_${openid}_${Deno.env.get('WECHAT_APP_ID')}`
    let userId: string

    if (!isRegistered && !invitationCode) {
      return new Response(
        JSON.stringify({ is_new_user: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let invitationUsage: any = null

    if (isRegistered) {
      if (!existingUser) {
        throw new Error('账号状态异常，请联系管理员')
      }
      userId = existingUser.id

      const { error: updateAuthError } = await supabase.auth.admin.updateUserById(userId, {
        password,
        user_metadata: { openid, ...userInfo }
      })
      if (updateAuthError) throw updateAuthError

      const { error: upsertProfileError } = await supabase
        .from('users')
        .upsert({
          id: userId,
          openid,
          nickname: userInfo?.nickName || existingUser.user_metadata?.nickName || 'WeChat User',
          avatar_url: userInfo?.avatarUrl || existingUser.user_metadata?.avatarUrl || '',
          phone_number: userInfo?.phoneNumber || null
        })
      if (upsertProfileError) {
        throw new Error(`用户资料写入失败: ${upsertProfileError.message}`)
      }
    } else {
      const { data: invitation, error: invitationError } = await supabase
        .from('invitation_codes')
        .select('*')
        .eq('code', invitationCode)
        .single()

      if (invitationError || !invitation) {
        throw new Error('邀请码无效')
      }
      if (!invitation.is_active) {
        throw new Error('邀请码已失效')
      }
      if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
        throw new Error('邀请码已过期')
      }
      if (invitation.use_count >= invitation.max_uses) {
        throw new Error('邀请码已达到使用上限')
      }

      if (existingUser) {
        userId = existingUser.id
        const { error: updateAuthError } = await supabase.auth.admin.updateUserById(userId, {
          password,
          user_metadata: { openid, ...userInfo }
        })
        if (updateAuthError) throw updateAuthError
      } else {
        const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { openid, ...userInfo }
        })
        if (createUserError) throw createUserError
        userId = newUser.user.id
      }

      const { error: insertProfileError } = await supabase
        .from('users')
        .insert({
          id: userId,
          openid: openid,
          nickname: userInfo?.nickName || 'WeChat User',
          avatar_url: userInfo?.avatarUrl || '',
          phone_number: userInfo?.phoneNumber || null
        })
      if (insertProfileError) {
        throw new Error(`用户资料创建失败: ${insertProfileError.message}`)
      }

      const nextUseCount = invitation.use_count + 1
      const { data: updatedInvitation, error: updateInvitationError } = await supabase
        .from('invitation_codes')
        .update({
          use_count: nextUseCount,
          used_by: userId,
          used_at: new Date().toISOString(),
          is_active: nextUseCount < invitation.max_uses
        })
        .eq('id', invitation.id)
        .eq('use_count', invitation.use_count)
        .select('*')
        .single()

      if (updateInvitationError || !updatedInvitation) {
        throw new Error('邀请码使用失败，请重试')
      }
      if (updatedInvitation.use_count > updatedInvitation.max_uses) {
        throw new Error('邀请码使用次数异常')
      }

      invitationUsage = {
        code: updatedInvitation.code,
        use_count: updatedInvitation.use_count,
        max_uses: updatedInvitation.max_uses,
        is_active: updatedInvitation.is_active
      }
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({ email, password })
    if (sessionError) throw sessionError

    const userProfile = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (userProfile.error || !userProfile.data) {
      throw new Error(`用户资料不存在或读取失败: ${userProfile.error?.message || 'empty profile'}`)
    }

    return new Response(
      JSON.stringify({
        ...sessionData.session,
        user: userProfile.data,
        invitation_usage: invitationUsage
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
