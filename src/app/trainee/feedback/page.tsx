import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TraineeFeedback } from '@/components/trainee/TraineeFeedback'

export default async function FeedbackPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: completions }, { data: trainingTasks }, { data: subcategories }, { data: categories }, { data: courses }] = await Promise.all([
    supabase.from('training_task_completions').select('*').eq('trainee_id', authUser.id).not('manager_coaching', 'is', null).order('signed_off_at', { ascending: false }),
    supabase.from('training_tasks').select('*').is('deleted_at', null),
    supabase.from('subcategories').select('*').is('deleted_at', null),
    supabase.from('categories').select('*, course:courses(*)').is('deleted_at', null),
    supabase.from('courses').select('*').is('deleted_at', null),
  ])

  return (
    <TraineeFeedback
      completions={completions ?? []}
      trainingTasks={trainingTasks ?? []}
      subcategories={subcategories ?? []}
      categories={categories ?? []}
      courses={courses ?? []}
    />
  )
}
