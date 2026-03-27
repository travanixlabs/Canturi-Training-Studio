import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TraineeProgress } from '@/components/trainee/TraineeProgress'

export default async function TraineeProgressPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: courses }, { data: categories }, { data: workshops }, { data: workshopCategories }] = await Promise.all([
    supabase.from('courses').select('*').eq('status', 'active').order('sort_order'),
    supabase.from('categories').select('*, course:courses(*)').eq('status', 'active'),
    supabase.from('workshops').select('*').eq('status', 'active').order('name'),
    supabase.from('workshop_categorys').select('*'),
  ])

  return (
    <TraineeProgress
      courses={courses ?? []}
      categories={categories ?? []}
      workshops={workshops ?? []}
      workshopCategories={workshopCategories ?? []}
    />
  )
}
