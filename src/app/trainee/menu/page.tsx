import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TraineeMenu } from '@/components/trainee/TraineeMenu'
import type { User } from '@/types'

export default async function TraineeMenuPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: categories }, { data: menuItems }, { data: completions }, { data: profile }, { data: visibleCats }] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('menu_items').select('*, category:categories(*)').eq('status', 'active').order('title'),
    supabase.from('completions').select('*').eq('trainee_id', authUser.id),
    supabase.from('users').select('*').eq('id', authUser.id).single(),
    supabase.from('visible_categories').select('category_id').eq('user_id', authUser.id),
  ])

  const visibleCategoryIds = new Set((visibleCats ?? []).map(v => v.category_id))
  const visibleMenuItems = (menuItems ?? []).filter(item => visibleCategoryIds.has(item.category_id))
  const visibleCategories = (categories ?? []).filter(c => visibleCategoryIds.has(c.id))

  return (
    <TraineeMenu
      categories={visibleCategories}
      menuItems={visibleMenuItems}
      completions={completions ?? []}
      currentUser={profile as User}
    />
  )
}
