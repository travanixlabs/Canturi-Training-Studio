import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CourseEditor } from '@/components/headoffice/CourseEditor'

export default async function HeadOfficeCoursesPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: categories }, { data: menuItems }] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('menu_items').select('*, category:categories(*)').order('title'),
  ])

  return (
    <CourseEditor
      categories={categories ?? []}
      menuItems={menuItems ?? []}
    />
  )
}
