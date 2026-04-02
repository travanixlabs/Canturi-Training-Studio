import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ManagerCoaching } from '@/components/manager/ManagerCoaching'
import type { User } from '@/types'

export default async function CoachingPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: manager } = await supabase.from('users').select('*').eq('id', authUser.id).single()
  if (!manager) redirect('/login')

  const [{ data: trainees }, { data: completions }, { data: trainingTasks }, { data: subcategories }, { data: categories }, { data: courses }] = await Promise.all([
    supabase.from('users').select('*').eq('boutique_id', manager.boutique_id).eq('role', 'trainee').order('name'),
    supabase.from('training_task_completions').select('*').order('completed_at', { ascending: false }),
    supabase.from('training_tasks').select('*').is('deleted_at', null),
    supabase.from('subcategories').select('*').is('deleted_at', null),
    supabase.from('categories').select('*, course:courses(*)').is('deleted_at', null),
    supabase.from('courses').select('*').is('deleted_at', null),
  ])

  const traineeIds = new Set((trainees ?? []).map(t => t.id))
  const filteredCompletions = (completions ?? []).filter(c => traineeIds.has(c.trainee_id))

  return (
    <ManagerCoaching
      manager={manager as User}
      trainees={(trainees ?? []) as User[]}
      completions={filteredCompletions}
      trainingTasks={trainingTasks ?? []}
      subcategories={subcategories ?? []}
      categories={categories ?? []}
      courses={courses ?? []}
    />
  )
}
