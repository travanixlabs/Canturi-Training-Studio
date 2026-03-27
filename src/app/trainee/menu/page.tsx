import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TraineeMenu } from '@/components/trainee/TraineeMenu'
import type { User } from '@/types'

export default async function TraineeMenuPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: categories }, { data: menuItems }, { data: completions }, { data: profile }, { data: visibleCats }, { data: recurringCompletions }, { data: plates }, { data: workshops }, { data: workshopMenuItems }] = await Promise.all([
    supabase.from('courses').select('*').eq('status', 'active').order('sort_order'),
    supabase.from('menu_items').select('*, course:courses(*)').eq('status', 'active').order('title'),
    supabase.from('completions').select('*').eq('trainee_id', authUser.id),
    supabase.from('users').select('*').eq('id', authUser.id).single(),
    supabase.from('visible_courses').select('course_id').eq('user_id', authUser.id),
    supabase.from('training_task_completions').select('*').eq('trainee_id', authUser.id),
    supabase.from('plates').select('*').eq('trainee_id', authUser.id),
    supabase.from('workshops').select('*').eq('status', 'active').order('name'),
    supabase.from('workshop_menu_items').select('*'),
  ])

  const visibleCategoryIds = new Set((visibleCats ?? []).map(v => v.course_id))
  const visibleMenuItems = (menuItems ?? []).filter(item => visibleCategoryIds.has(item.course_id))
  const visibleCategories = (categories ?? []).filter(c => visibleCategoryIds.has(c.id))

  return (
    <TraineeMenu
      categories={visibleCategories}
      menuItems={visibleMenuItems}
      completions={completions ?? []}
      currentUser={profile as User}
      recurringCompletions={recurringCompletions ?? []}
      plates={plates ?? []}
      workshops={workshops ?? []}
      workshopMenuItems={workshopMenuItems ?? []}
    />
  )
}
