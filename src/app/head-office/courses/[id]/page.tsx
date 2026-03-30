import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CourseContentEditor } from '@/components/headoffice/CourseContentEditor'

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: categoryItem }, { data: courses }, { data: subcategories }, { data: trainingTasks }, { data: attachments }] = await Promise.all([
    supabase.from('categories').select('*, course:courses(*)').is('deleted_at', null).eq('id', id).single(),
    supabase.from('courses').select('*').is('deleted_at', null).order('sort_order'),
    supabase.from('subcategories').select('*').is('deleted_at', null).eq('category_id', id).order('sort_order'),
    supabase.from('training_tasks').select('*').is('deleted_at', null).order('sort_order'),
    supabase.from('training_task_content').select('*').is('deleted_at', null).order('sort_order'),
  ])

  if (!categoryItem) redirect('/head-office/courses')

  return (
    <CourseContentEditor
      categoryItem={categoryItem}
      courses={courses ?? []}
      subcategories={subcategories ?? []}
      trainingTasks={trainingTasks ?? []}
      attachments={attachments ?? []}
    />
  )
}
