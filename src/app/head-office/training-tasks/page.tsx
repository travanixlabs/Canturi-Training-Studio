import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TrainingTasksTable } from '@/components/headoffice/TrainingTasksTable'

export default async function TrainingTasksPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: courses }, { data: categories }, { data: subcategories }, { data: trainingTasks }] = await Promise.all([
    supabase.from('courses').select('*').is('deleted_at', null).order('sort_order'),
    supabase.from('categories').select('*').is('deleted_at', null).order('sort_order'),
    supabase.from('subcategories').select('*').is('deleted_at', null).order('sort_order'),
    supabase.from('training_tasks').select('*').is('deleted_at', null).order('sort_order'),
  ])

  return (
    <TrainingTasksTable
      courses={courses ?? []}
      categories={categories ?? []}
      subcategories={subcategories ?? []}
      trainingTasks={trainingTasks ?? []}
    />
  )
}
