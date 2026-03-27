import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TraineeMenu } from '@/components/trainee/TraineeMenu'
import type { User } from '@/types'

export default async function TraineeMenuPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: courses }, { data: categories }, { data: profile }, { data: workshops }, { data: workshopCategories }] = await Promise.all([
    supabase.from('courses').select('*').eq('status', 'active').order('sort_order'),
    supabase.from('categories').select('*, course:courses(*)').eq('status', 'active').order('title'),
    supabase.from('users').select('*').eq('id', authUser.id).single(),
    supabase.from('workshops').select('*').eq('status', 'active').order('name'),
    supabase.from('workshop_categorys').select('*'),
  ])

  return (
    <TraineeMenu
      courses={courses ?? []}
      categories={categories ?? []}
      currentUser={profile as User}
      workshops={workshops ?? []}
      workshopCategories={workshopCategories ?? []}
    />
  )
}
