import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CourseEditor } from '@/components/headoffice/CourseEditor'

export default async function HeadOfficeCoursesPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: courses }, { data: categories }] = await Promise.all([
    supabase.from('courses').select('*').is('deleted_at', null).order('sort_order'),
    supabase.from('categories').select('*, course:courses(*)').is('deleted_at', null).order('sort_order'),
  ])

  return (
    <CourseEditor
      courses={courses ?? []}
      categories={categories ?? []}
    />
  )
}
