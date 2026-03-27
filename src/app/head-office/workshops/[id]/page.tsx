import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WorkshopEditor } from '@/components/headoffice/WorkshopEditor'

export default async function EditWorkshopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: workshop }, { data: categories }, { data: menuItems }, { data: workshopMenuItems }] = await Promise.all([
    supabase.from('workshops').select('*').eq('id', id).single(),
    supabase.from('courses').select('*').eq('status', 'active').order('sort_order'),
    supabase.from('menu_items').select('*, course:courses(*)').eq('status', 'active').order('title'),
    supabase.from('workshop_menu_items').select('*').eq('workshop_id', id),
  ])

  if (!workshop) redirect('/head-office/workshops')

  return (
    <WorkshopEditor
      workshop={workshop}
      categories={categories ?? []}
      menuItems={menuItems ?? []}
      workshopMenuItems={workshopMenuItems ?? []}
    />
  )
}
