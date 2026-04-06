import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  // Verify the requesting user is head_office
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', authUser.id).single()
  if (!profile || profile.role !== 'head_office') {
    return NextResponse.json({ error: 'Only head office can impersonate' }, { status: 403 })
  }

  // Use admin client to generate a magic link / session for the target user
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get the target user's email
  const { data: targetUser } = await admin.auth.admin.getUserById(userId)
  if (!targetUser?.user?.email) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Generate a magic link for the target user
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: targetUser.user.email,
  })

  if (linkError || !linkData) {
    return NextResponse.json({ error: linkError?.message || 'Failed to generate link' }, { status: 500 })
  }

  // Extract the token and use it to create a session
  const { data: sessionData, error: sessionError } = await admin.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  })

  if (sessionError || !sessionData.session) {
    return NextResponse.json({ error: sessionError?.message || 'Failed to create session' }, { status: 500 })
  }

  // Set the session cookies
  const cookieStore = await cookies()
  cookieStore.set('sb-ypmzdiyrozzrgdggedtg-auth-token', JSON.stringify({
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
  }), {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60, // 1 hour
  })

  // Determine redirect based on target user's role
  const { data: targetProfile } = await supabase.from('users').select('role').eq('id', userId).single()
  const role = targetProfile?.role ?? 'trainee'
  const redirectTo = role === 'manager' ? '/manager' : role === 'head_office' ? '/head-office' : '/trainee'

  return NextResponse.json({ success: true, redirectTo })
}
