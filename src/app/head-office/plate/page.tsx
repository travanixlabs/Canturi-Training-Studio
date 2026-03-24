import { createClient } from '@/lib/supabase/server'
import { todayAEDT } from '@/lib/dates'
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

  const today = todayAEDT()

  const [{ data: trainees }, { data: categories }, { data: menuItems }, { data: allPlates }, { data: visibleCats }, { data: completions }, { data: recurringCompletions }, { data: workshops }, { data: workshopMenuItems }] = await Promise.all([
    supabase.from('users').select('*, boutique:boutiques(*)').eq('role', 'trainee'),
    supabase.from('categories').select('*').eq('status', 'active').order('sort_order'),
    supabase.from('menu_items').select('*, category:categories(*)').eq('status', 'active').order('title'),
    supabase.from('plates').select('*'),
    supabase.from('visible_categories').select('*'),
    supabase.from('completions').select('*'),
    supabase.from('recurring_task_completions').select('*'),
    supabase.from('workshops').select('*').eq('status', 'active').order('name'),
    supabase.from('workshop_menu_items').select('*'),
  ])

  return (
    <BuildPlate
      manager={hoUser as User}
      trainees={trainees ?? []}
      categories={categories ?? []}
      menuItems={menuItems ?? []}
      todayPlates={allPlates ?? []}
      visibleCategories={visibleCats ?? []}
      completions={completions ?? []}
      recurringCompletions={recurringCompletions ?? []}
      workshops={workshops ?? []}
      workshopMenuItems={workshopMenuItems ?? []}
      showBoutique
    />
  )
}
