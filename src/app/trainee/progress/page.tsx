import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TraineeProgress } from '@/components/trainee/TraineeProgress'

export default async function TraineeProgressPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: categories }, { data: menuItems }, { data: completions }, { data: visibleCats }, { data: workshops }, { data: workshopMenuItems }] = await Promise.all([
    supabase.from('categories').select('*').eq('status', 'active').order('sort_order'),
    supabase.from('menu_items').select('*, category:categories(*)').eq('status', 'active'),
    supabase.from('completions').select('*').eq('trainee_id', authUser.id),
    supabase.from('visible_categories').select('category_id').eq('user_id', authUser.id),
    supabase.from('workshops').select('*').eq('status', 'active').order('name'),
    supabase.from('workshop_menu_items').select('*'),
  ])

  const visibleCategoryIds = new Set((visibleCats ?? []).map(v => v.category_id))
  const visibleMenuItems = (menuItems ?? []).filter(item => visibleCategoryIds.has(item.category_id))
  const visibleCategories = (categories ?? []).filter(c => visibleCategoryIds.has(c.id))

  return (
    <TraineeProgress
      categories={visibleCategories}
      menuItems={visibleMenuItems}
      completions={completions ?? []}
      workshops={workshops ?? []}
      workshopMenuItems={workshopMenuItems ?? []}
    />
  )
}
