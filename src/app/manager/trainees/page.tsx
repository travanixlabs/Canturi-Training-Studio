import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ManagerTrainees } from '@/components/manager/ManagerTrainees'

export default async function TraineesPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: manager } = await supabase.from('users').select('*').eq('id', authUser.id).single()
  if (!manager) redirect('/login')

  const traineeIds = (
    await supabase.from('users').select('id').eq('boutique_id', manager.boutique_id).eq('role', 'trainee')
  ).data?.map(u => u.id) ?? []

  const [{ data: trainees }, { data: categories }, { data: menuItems }, { data: completions }, { data: plates }, { data: visibleCats }, { data: workshops }, { data: workshopMenuItems }] = await Promise.all([
    supabase.from('users').select('*').eq('boutique_id', manager.boutique_id).eq('role', 'trainee'),
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('menu_items').select('*').eq('status', 'active'),
    traineeIds.length > 0
      ? supabase.from('completions').select('*').in('trainee_id', traineeIds)
      : Promise.resolve({ data: [] }),
    traineeIds.length > 0
      ? supabase.from('plates').select('*').in('trainee_id', traineeIds)
      : Promise.resolve({ data: [] }),
    supabase.from('visible_categories').select('*'),
    supabase.from('workshops').select('*').eq('status', 'active').order('name'),
    supabase.from('workshop_menu_items').select('*'),
  ])

  return (
    <ManagerTrainees
      trainees={trainees ?? []}
      categories={categories ?? []}
      menuItems={menuItems ?? []}
      completions={completions ?? []}
      plates={plates ?? []}
      visibleCategories={visibleCats ?? []}
      workshops={workshops ?? []}
      workshopMenuItems={workshopMenuItems ?? []}
    />
  )
}
