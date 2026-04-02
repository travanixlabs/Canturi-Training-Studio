import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TraineeDayPlate } from '@/components/trainee/TraineeDayPlate'
import type { User } from '@/types'

export default async function DayPlatePage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: profile }, { data: assignments }, { data: trainingTasks }, { data: taskContent }, { data: completions }, { data: subcategories }, { data: categories }, { data: courses }, { data: drafts }] = await Promise.all([
    supabase.from('users').select('*').eq('id', authUser.id).single(),
    supabase.from('training_task_assigned').select('*').eq('trainee_id', authUser.id),
    supabase.from('training_tasks').select('*').is('deleted_at', null),
    supabase.from('training_task_content').select('*').is('deleted_at', null).order('sort_order'),
    supabase.from('training_task_completions').select('*').eq('trainee_id', authUser.id),
    supabase.from('subcategories').select('*').is('deleted_at', null),
    supabase.from('categories').select('*, course:courses(*)').is('deleted_at', null),
    supabase.from('courses').select('*').is('deleted_at', null),
    supabase.from('training_task_completions_draft').select('*').eq('trainee_id', authUser.id),
  ])

  return (
    <TraineeDayPlate
      currentUser={profile as User}
      assignments={assignments ?? []}
      trainingTasks={trainingTasks ?? []}
      taskContent={taskContent ?? []}
      completions={completions ?? []}
      subcategories={subcategories ?? []}
      categories={categories ?? []}
      courses={courses ?? []}
      drafts={drafts ?? []}
    />
  )
}
