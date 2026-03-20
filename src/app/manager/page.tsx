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

  const [{ data: trainees }, { data: categories }, { data: menuItems }, { data: todayPlates }] = await Promise.all([
    supabase.from('users').select('*').eq('boutique_id', manager.boutique_id).eq('role', 'trainee'),
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('menu_items').select('*, category:categories(*)').eq('is_visible', true).order('title'),
    supabase.from('plates').select('*').eq('date_assigned', today).eq('boutique_id', manager.boutique_id),
  ])

  return (
    <BuildPlate
      manager={manager as User}
      trainees={trainees ?? []}
      categories={categories ?? []}
      menuItems={menuItems ?? []}
      todayPlates={todayPlates ?? []}
    />
  )
}
