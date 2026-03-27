import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HeadOfficeDashboard } from '@/components/headoffice/HeadOfficeDashboard'

export default async function HeadOfficePage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: boutiques }, { data: allUsers }, { data: menuItems }, { data: completions }, { data: plates }, { data: visibleCats }] = await Promise.all([
    supabase.from('boutiques').select('*').order('city'),
    supabase.from('users').select('*'),
    supabase.from('menu_items').select('*').eq('status', 'active'),
    supabase
      .from('completions')
      .select('*, menu_item:menu_items(title, course:courses(name)), trainee:users!completions_trainee_id_fkey(name, boutique_id)')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('plates').select('*'),
    supabase.from('visible_courses').select('*'),
  ])

  return (
    <HeadOfficeDashboard
      boutiques={boutiques ?? []}
      allUsers={allUsers ?? []}
      menuItems={menuItems ?? []}
      completions={completions ?? []}
      plates={plates ?? []}
      visibleCategories={visibleCats ?? []}
    />
  )
}
