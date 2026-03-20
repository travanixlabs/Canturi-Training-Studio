import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TraineeMenu } from '@/components/trainee/TraineeMenu'
import type { User } from '@/types'

export default async function TraineeMenuPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: categories }, { data: menuItems }, { data: completions }, { data: profile }, { data: hiddenItems }] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('menu_items').select('*, category:categories(*)').order('title'),
    supabase.from('completions').select('*').eq('trainee_id', authUser.id),
    supabase.from('users').select('*').eq('id', authUser.id).single(),
    supabase.from('hidden_menu_items').select('menu_item_id').eq('user_id', authUser.id),
  ])

  const hiddenIds = new Set((hiddenItems ?? []).map(h => h.menu_item_id))
  const visibleMenuItems = (menuItems ?? []).filter(item => !hiddenIds.has(item.id))

  return (
    <TraineeMenu
      categories={categories ?? []}
      menuItems={visibleMenuItems}
      completions={completions ?? []}
      currentUser={profile as User}
    />
  )
}
