import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WorkshopList } from '@/components/headoffice/WorkshopList'

export default async function HeadOfficeWorkshopsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: workshops }, { data: workshopCategories }] = await Promise.all([
    supabase.from('workshops').select('*').order('created_at', { ascending: false }),
    supabase.from('workshop_categorys').select('*'),
  ])

  return (
    <WorkshopList
      workshops={workshops ?? []}
      workshopCategories={workshopCategories ?? []}
    />
  )
}
