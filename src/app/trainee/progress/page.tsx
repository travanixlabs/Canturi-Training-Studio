import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TraineeProgress } from '@/components/trainee/TraineeProgress'

export default async function TraineeProgressPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: categories }, { data: menuItems }, { data: completions }, { data: visibleCats }, { data: workshops }, { data: workshopMenuItems }, { data: recurringCompletions }, { data: plates }] = await Promise.all([
    supabase.from('courses').select('*').eq('status', 'active').order('sort_order'),
    supabase.from('menu_items').select('*, course:courses(*)').eq('status', 'active'),
    supabase.from('completions').select('*').eq('trainee_id', authUser.id),
    supabase.from('visible_courses').select('course_id').eq('user_id', authUser.id),
    supabase.from('workshops').select('*').eq('status', 'active').order('name'),
    supabase.from('workshop_menu_items').select('*'),
    supabase.from('training_task_completions').select('*').eq('trainee_id', authUser.id),
    supabase.from('plates').select('*').eq('trainee_id', authUser.id),
  ])

  const visibleCategoryIds = new Set((visibleCats ?? []).map(v => v.course_id))
  const visibleMenuItems = (menuItems ?? []).filter(item => visibleCategoryIds.has(item.course_id))
  const visibleCategories = (categories ?? []).filter(c => visibleCategoryIds.has(c.id))

  return (
    <TraineeProgress
      categories={visibleCategories}
      menuItems={visibleMenuItems}
      completions={completions ?? []}
      workshops={workshops ?? []}
      workshopMenuItems={workshopMenuItems ?? []}
      recurringCompletions={recurringCompletions ?? []}
      plates={plates ?? []}
    />
  )
}
