'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    return { error: 'Incorrect email or password. Please try again.' }
  }

  // Fetch role for redirect
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Something went wrong. Please try again.' }
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role
  if (role === 'manager') redirect('/manager')
  else if (role === 'head_office') redirect('/head-office')
  else redirect('/trainee')
}
