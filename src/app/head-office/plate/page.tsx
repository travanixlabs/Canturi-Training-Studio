import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BuildPlate } from '@/components/manager/BuildPlate'
import type { User } from '@/types'

export default async function HeadOfficePlatePage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: hoUser } = await supabase
    .from('users')
    .select('*, boutique:boutiques(*)')
    .eq('id', authUser.id)
    .single()

  if (!hoUser) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  const [{ data: trainees }, { data: categories }, { data: menuItems }, { data: todayPlates }, { data: visibleCats }] = await Promise.all([
    supabase.from('users').select('*, boutique:boutiques(*)').in('role', ['trainee', 'manager']),
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('menu_items').select('*, category:categories(*)').order('title'),
    supabase.from('plates').select('*').eq('date_assigned', today),
    supabase.from('visible_categories').select('*'),
  ])

  return (
    <BuildPlate
      manager={hoUser as User}
      trainees={trainees ?? []}
      categories={categories ?? []}
      menuItems={menuItems ?? []}
      todayPlates={todayPlates ?? []}
      visibleCategories={visibleCats ?? []}
      showBoutique
    />
  )
}
