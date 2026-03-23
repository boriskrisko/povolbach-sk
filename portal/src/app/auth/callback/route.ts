import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
    return NextResponse.redirect(`${origin}/auth/confirmed`)
  }

  if (token_hash && type) {
    const supabase = await createClient()
    await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'signup' | 'email',
    })
    return NextResponse.redirect(`${origin}/auth/confirmed`)
  }

  return NextResponse.redirect(`${origin}/login?error=invalid_callback`)
}
