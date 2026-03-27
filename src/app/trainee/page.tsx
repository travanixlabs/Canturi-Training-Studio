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
      category:categories(*, course:courses(*))
    `)
    .eq('trainee_id', authUser.id)
    .order('date_assigned', { ascending: true })

  // Fetch all completions with category join, profile, workshops, and visibility
  const [{ data: allCompletions }, { data: profile }, { data: workshops }, { data: workshopCategories }, { data: visibleCats }] = await Promise.all([
    supabase.from('completions').select('*, category:categories(*, course:courses(*))').eq('trainee_id', authUser.id),
    supabase.from('users').select('*').eq('id', authUser.id).single(),
    supabase.from('workshops').select('*').eq('status', 'active').order('name'),
    supabase.from('workshop_categorys').select('*'),
    supabase.from('visible_courses').select('course_id').eq('user_id', authUser.id),
  ])

  // Filter plates and completions to only visible categories
  const visibleCategoryIds = new Set((visibleCats ?? []).map(v => v.course_id))
  const filteredPlates = (allPlates ?? []).filter(p => p.category?.course_id && visibleCategoryIds.has(p.category.course_id))
  const filteredCompletions = (allCompletions ?? []).filter(c => {
    const catId = (c.category as any)?.course_id
    return catId && visibleCategoryIds.has(catId)
  })

  return (
    <TodaysPlate
      allPlates={filteredPlates}
      allCompletions={filteredCompletions}
      currentUser={profile as User}
      workshops={workshops ?? []}
      workshopCategories={workshopCategories ?? []}
    />
  )
}
