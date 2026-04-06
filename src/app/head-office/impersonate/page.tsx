import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ImpersonateUsers } from '@/components/headoffice/ImpersonateUsers'
import type { User } from '@/types'

export default async function ImpersonatePage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: users } = await supabase
    .from('users')
    .select('*, boutique:boutiques(*)')
    .order('name')

  return <ImpersonateUsers users={(users ?? []) as User[]} />
}
