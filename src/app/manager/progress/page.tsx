import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ManagerTrainees } from '@/components/manager/ManagerTrainees'

export default async function TraineesPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: manager } = await supabase.from('users').select('*').eq('id', authUser.id).single()
  if (!manager) redirect('/login')

  const { data: trainees } = await supabase
    .from('users')
    .select('*')
    .eq('boutique_id', manager.boutique_id)
    .eq('role', 'trainee')

  return (
    <ManagerTrainees trainees={trainees ?? []} />
  )
}
