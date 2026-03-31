import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BuildPlate } from '@/components/manager/BuildPlate'
import type { User } from '@/types'

export default async function BuildPlatePage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: manager } = await supabase.from('users').select('*').eq('id', authUser.id).single()
  if (!manager) redirect('/login')

  const [{ data: trainees }, { data: courses }, { data: categories }, { data: workshops }, { data: workshopCourses }, { data: subcategories }, { data: trainingTasks }, { data: completions }] = await Promise.all([
    supabase.from('users').select('*').eq('boutique_id', manager.boutique_id).eq('role', 'trainee').order('name'),
    supabase.from('courses').select('*').eq('status', 'active').is('deleted_at', null).order('sort_order'),
    supabase.from('categories').select('*, course:courses(*)').is('deleted_at', null).order('sort_order'),
    supabase.from('workshops').select('*').is('deleted_at', null).eq('status', 'active').order('name'),
    supabase.from('workshop_courses').select('*'),
    supabase.from('subcategories').select('*').is('deleted_at', null).order('sort_order'),
    supabase.from('training_tasks').select('*').is('deleted_at', null).order('sort_order'),
    supabase.from('training_task_completions').select('*'),
  ])

  return (
    <BuildPlate
      trainees={(trainees ?? []) as User[]}
      courses={courses ?? []}
      categories={categories ?? []}
      workshops={workshops ?? []}
      workshopCourses={workshopCourses ?? []}
      subcategories={subcategories ?? []}
      trainingTasks={trainingTasks ?? []}
      completions={completions ?? []}
    />
  )
}
