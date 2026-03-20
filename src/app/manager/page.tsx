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

  const [{ data: trainees }, { data: categories }, { data: menuItems }, { data: allPlates }, { data: visibleCats }, { data: completions }] = await Promise.all([
    supabase.from('users').select('*').eq('boutique_id', manager.boutique_id).eq('role', 'trainee'),
    supabase.from('categories').select('*').eq('status', 'active').order('sort_order'),
    supabase.from('menu_items').select('*, category:categories(*)').eq('status', 'active').order('title'),
    supabase.from('plates').select('*'),
    supabase.from('visible_categories').select('*'),
    supabase.from('completions').select('*'),
  ])

  return (
    <BuildPlate
      manager={manager as User}
      trainees={trainees ?? []}
      categories={categories ?? []}
      menuItems={menuItems ?? []}
      todayPlates={allPlates ?? []}
      visibleCategories={visibleCats ?? []}
      completions={completions ?? []}
    />
  )
}
