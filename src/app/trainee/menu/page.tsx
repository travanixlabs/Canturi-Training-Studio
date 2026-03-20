import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TraineeMenu } from '@/components/trainee/TraineeMenu'
import type { User } from '@/types'

export default async function TraineeMenuPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: categories }, { data: menuItems }, { data: completions }, { data: profile }] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('menu_items').select('*, category:categories(*)').eq('is_visible', true).order('title'),
    supabase.from('completions').select('*').eq('trainee_id', authUser.id),
    supabase.from('users').select('*').eq('id', authUser.id).single(),
  ])

  return (
    <TraineeMenu
      categories={categories ?? []}
      menuItems={menuItems ?? []}
      completions={completions ?? []}
      currentUser={profile as User}
    />
  )
}
