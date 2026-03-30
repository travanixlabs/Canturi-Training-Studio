import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WorkshopEditor } from '@/components/headoffice/WorkshopEditor'

export default async function EditWorkshopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: workshop }, { data: courses }, { data: categories }, { data: workshopCourses }] = await Promise.all([
    supabase.from('workshops').select('*').is('deleted_at', null).eq('id', id).single(),
    supabase.from('courses').select('*').eq('status', 'active').is('deleted_at', null).order('sort_order'),
    supabase.from('categories').select('*').is('deleted_at', null).order('sort_order'),
    supabase.from('workshop_courses').select('*').eq('workshop_id', id),
  ])

  if (!workshop) redirect('/head-office/workshops')

  return (
    <WorkshopEditor
      workshop={workshop}
      courses={courses ?? []}
      categories={categories ?? []}
      workshopCourses={workshopCourses ?? []}
    />
  )
}
