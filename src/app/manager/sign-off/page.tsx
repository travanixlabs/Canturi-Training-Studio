import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ManagerSignOff } from '@/components/manager/ManagerSignOff'
import type { User } from '@/types'

export default async function SignOffPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: manager } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (!manager) redirect('/login')

  const traineeIds = (await supabase.from('users').select('id').eq('boutique_id', manager.boutique_id).eq('role', 'trainee')).data?.map(u => u.id) ?? []

  const [{ data: trainees }, { data: completions }, { data: menuItems }, { data: plates }] = await Promise.all([
    supabase.from('users').select('*').eq('boutique_id', manager.boutique_id).eq('role', 'trainee'),
    supabase
      .from('completions')
      .select('*, menu_item:menu_items(*, category:categories(*)), trainee:users!completions_trainee_id_fkey(*)')
      .in('trainee_id', traineeIds)
      .order('created_at', { ascending: false }),
    supabase.from('menu_items').select('*, category:categories(*)').eq('status', 'active'),
    supabase.from('plates').select('*').in('trainee_id', traineeIds),
  ])

  return (
    <ManagerSignOff
      manager={manager as User}
      trainees={trainees ?? []}
      completions={completions ?? []}
      menuItems={menuItems ?? []}
      plates={plates ?? []}
    />
  )
}
