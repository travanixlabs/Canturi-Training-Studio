import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HeadOfficeDashboard } from '@/components/headoffice/HeadOfficeDashboard'

export default async function HeadOfficePage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: boutiques }, { data: allUsers }] = await Promise.all([
    supabase.from('boutiques').select('*').order('city'),
    supabase.from('users').select('*'),
  ])

  return (
    <HeadOfficeDashboard
      boutiques={boutiques ?? []}
      allUsers={allUsers ?? []}
    />
  )
}
