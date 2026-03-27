import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TraineeProgress } from '@/components/trainee/TraineeProgress'

export default async function TraineeProgressPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: courses }, { data: categories }, { data: completions }, { data: visibleCats }, { data: workshops }, { data: workshopCategories }, { data: plates }] = await Promise.all([
    supabase.from('courses').select('*').eq('status', 'active').order('sort_order'),
    supabase.from('categories').select('*, course:courses(*)').eq('status', 'active'),
    supabase.from('completions').select('*').eq('trainee_id', authUser.id),
    supabase.from('visible_courses').select('course_id').eq('user_id', authUser.id),
    supabase.from('workshops').select('*').eq('status', 'active').order('name'),
    supabase.from('workshop_categorys').select('*'),
    supabase.from('plates').select('*').eq('trainee_id', authUser.id),
  ])

  const visibleCategoryIds = new Set((visibleCats ?? []).map(v => v.course_id))
  const visibleCategorys = (categories ?? []).filter(item => visibleCategoryIds.has(item.course_id))
  const visibleCourses = (courses ?? []).filter(c => visibleCategoryIds.has(c.id))

  return (
    <TraineeProgress
      courses={visibleCourses}
      categories={visibleCategorys}
      completions={completions ?? []}
      workshops={workshops ?? []}
      workshopCategories={workshopCategories ?? []}
      plates={plates ?? []}
    />
  )
}
