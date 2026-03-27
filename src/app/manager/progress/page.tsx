import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ManagerTrainees } from '@/components/manager/ManagerTrainees'

export default async function TraineesPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: manager } = await supabase.from('users').select('*').eq('id', authUser.id).single()
  if (!manager) redirect('/login')

  const traineeIds = (
    await supabase.from('users').select('id').eq('boutique_id', manager.boutique_id).eq('role', 'trainee')
  ).data?.map(u => u.id) ?? []

  const [{ data: trainees }, { data: courses }, { data: categories }, { data: completions }, { data: plates }, { data: visibleCats }, { data: workshops }, { data: workshopCategories }] = await Promise.all([
    supabase.from('users').select('*').eq('boutique_id', manager.boutique_id).eq('role', 'trainee'),
    supabase.from('courses').select('*').order('sort_order'),
    supabase.from('categories').select('*').eq('status', 'active'),
    traineeIds.length > 0
      ? supabase.from('completions').select('*').in('trainee_id', traineeIds)
      : Promise.resolve({ data: [] }),
    traineeIds.length > 0
      ? supabase.from('plates').select('*').in('trainee_id', traineeIds)
      : Promise.resolve({ data: [] }),
    supabase.from('visible_courses').select('*'),
    supabase.from('workshops').select('*').eq('status', 'active').order('name'),
    supabase.from('workshop_categorys').select('*'),
  ])

  return (
    <ManagerTrainees
      trainees={trainees ?? []}
      courses={courses ?? []}
      categories={categories ?? []}
      completions={completions ?? []}
      plates={plates ?? []}
      visibleCategories={visibleCats ?? []}
      workshops={workshops ?? []}
      workshopCategories={workshopCategories ?? []}
    />
  )
}
