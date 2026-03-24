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

  // Fetch all completions with menu_item join, all recurring completions, and profile
  const [{ data: allCompletions }, { data: profile }, { data: allRecurringCompletions }] = await Promise.all([
    supabase.from('completions').select('*, menu_item:menu_items(*, category:categories(*))').eq('trainee_id', authUser.id),
    supabase.from('users').select('*').eq('id', authUser.id).single(),
    supabase.from('recurring_task_completions').select('*').eq('trainee_id', authUser.id),
  ])

  return (
    <TodaysPlate
      allPlates={allPlates ?? []}
      allCompletions={allCompletions ?? []}
      allRecurringCompletions={allRecurringCompletions ?? []}
      currentUser={profile as User}
    />
  )
}
