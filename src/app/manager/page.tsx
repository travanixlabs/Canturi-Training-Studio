import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BuildPlate } from '@/components/manager/BuildPlate'
import type { User } from '@/types'

export default async function ManagerPlatePage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: manager } = await supabase
    .from('users')
    .select('*, boutique:boutiques(*)')
    .eq('id', authUser.id)
    .single()

  if (!manager) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  const [{ data: trainees }, { data: categories }, { data: menuItems }, { data: todayPlates }, { data: hiddenItems }] = await Promise.all([
    supabase.from('users').select('*').eq('boutique_id', manager.boutique_id).eq('role', 'trainee'),
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('menu_items').select('*, category:categories(*)').order('title'),
    supabase.from('plates').select('*').eq('date_assigned', today).eq('boutique_id', manager.boutique_id),
    supabase.from('hidden_menu_items').select('*'),
  ])

  return (
    <BuildPlate
      manager={manager as User}
      trainees={trainees ?? []}
      categories={categories ?? []}
      menuItems={menuItems ?? []}
      todayPlates={todayPlates ?? []}
      hiddenItems={hiddenItems ?? []}
    />
  )
}
