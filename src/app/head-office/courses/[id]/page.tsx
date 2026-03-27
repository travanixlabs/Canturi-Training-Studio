import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CourseContentEditor } from '@/components/headoffice/CourseContentEditor'

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: categoryItem }, { data: modules }, { data: categories }] = await Promise.all([
    supabase.from('categories').select('*, course:courses(*)').eq('id', id).single(),
    supabase.from('subcategories').select('*').eq('category_id', id).order('sort_order'),
    supabase.from('courses').select('*').order('sort_order'),
  ])

  if (!categoryItem) redirect('/head-office/courses')

  return (
    <CourseContentEditor
      categoryItem={categoryItem}
      initialModules={modules ?? []}
      categories={categories ?? []}
    />
  )
}
