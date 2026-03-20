import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HeadOfficeProgress } from '@/components/headoffice/HeadOfficeProgress'

export default async function HeadOfficeProgressPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: boutiques }, { data: allUsers }, { data: categories }, { data: menuItems }, { data: completions }, { data: plates }, { data: visibleCats }] = await Promise.all([
    supabase.from('boutiques').select('*').order('city'),
    supabase.from('users').select('*, boutique:boutiques(*)'),
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('menu_items').select('*').eq('status', 'active'),
    supabase.from('completions').select('*'),
    supabase.from('plates').select('*'),
    supabase.from('visible_categories').select('*'),
  ])

  return (
    <HeadOfficeProgress
      boutiques={boutiques ?? []}
      allUsers={allUsers ?? []}
      categories={categories ?? []}
      menuItems={menuItems ?? []}
      completions={completions ?? []}
      plates={plates ?? []}
      visibleCategories={visibleCats ?? []}
    />
  )
}
