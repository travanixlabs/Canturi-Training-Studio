import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TodaysPlate } from '@/components/trainee/TodaysPlate'
import type { User } from '@/types'

export default async function TraineePlatePage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  // Fetch ALL plates for this trainee (all dates)
  const { data: allPlates } = await supabase
    .from('plates')
    .select(`
      *,
      menu_item:menu_items(*, category:categories(*))
    `)
    .eq('trainee_id', authUser.id)
    .order('date_assigned', { ascending: true })

  // Fetch all completions with menu_item join, all recurring completions, profile, workshops, and visibility
  const [{ data: allCompletions }, { data: profile }, { data: allRecurringCompletions }, { data: workshops }, { data: workshopMenuItems }, { data: visibleCats }] = await Promise.all([
    supabase.from('completions').select('*, menu_item:menu_items(*, category:categories(*))').eq('trainee_id', authUser.id),
    supabase.from('users').select('*').eq('id', authUser.id).single(),
    supabase.from('recurring_task_completions').select('*').eq('trainee_id', authUser.id),
    supabase.from('workshops').select('*').eq('status', 'active').order('name'),
    supabase.from('workshop_menu_items').select('*'),
    supabase.from('visible_categories').select('category_id').eq('user_id', authUser.id),
  ])

  // Filter plates and completions to only visible categories
  const visibleCategoryIds = new Set((visibleCats ?? []).map(v => v.category_id))
  const filteredPlates = (allPlates ?? []).filter(p => p.menu_item?.category_id && visibleCategoryIds.has(p.menu_item.category_id))
  const filteredCompletions = (allCompletions ?? []).filter(c => {
    const catId = (c.menu_item as any)?.category_id
    return catId && visibleCategoryIds.has(catId)
  })
  const filteredRecurring = (allRecurringCompletions ?? []).filter(rc => {
    const plate = (allPlates ?? []).find(p => p.menu_item_id === rc.menu_item_id)
    const catId = plate?.menu_item?.category_id
    return catId && visibleCategoryIds.has(catId)
  })

  return (
    <TodaysPlate
      allPlates={filteredPlates}
      allCompletions={filteredCompletions}
      allRecurringCompletions={filteredRecurring}
      currentUser={profile as User}
      workshops={workshops ?? []}
      workshopMenuItems={workshopMenuItems ?? []}
    />
  )
}
