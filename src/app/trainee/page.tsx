import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TodaysPlate } from '@/components/trainee/TodaysPlate'
import type { User } from '@/types'

export default async function TraineePlatePage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  // Fetch today's plate items with their menu items and categories
  const { data: plates } = await supabase
    .from('plates')
    .select(`
      *,
      menu_item:menu_items(*, category:categories(*))
    `)
    .eq('trainee_id', authUser.id)
    .eq('date_assigned', today)
    .order('created_at', { ascending: true })

  // Fetch all completions for this trainee
  const [{ data: completions }, { data: profile }, { data: todayCompletions }, { data: recurringCompletions }] = await Promise.all([
    supabase.from('completions').select('*').eq('trainee_id', authUser.id),
    supabase.from('users').select('*').eq('id', authUser.id).single(),
    supabase.from('completions').select('*, menu_item:menu_items(*, category:categories(*))').eq('trainee_id', authUser.id).eq('completed_date', today),
    supabase.from('recurring_task_completions').select('*').eq('trainee_id', authUser.id),
  ])

  // Find shadowed completions today that aren't on a plate
  const plateMenuItemIds = new Set((plates ?? []).map(p => p.menu_item_id))
  const shadowedToday = (todayCompletions ?? []).filter(
    c => c.is_shadowing_moment && !plateMenuItemIds.has(c.menu_item_id)
  )

  return (
    <TodaysPlate
      plates={plates ?? []}
      completions={completions ?? []}
      shadowedToday={shadowedToday}
      currentUser={profile as User}
      recurringCompletions={recurringCompletions ?? []}
    />
  )
}
