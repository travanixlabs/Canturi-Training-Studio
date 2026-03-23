import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CourseDetail } from '@/components/trainee/CourseDetail'
import type { User } from '@/types'

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: menuItem }, { data: modules }, { data: moduleCompletions }, { data: completion }, { data: profile }, { data: plate }, { data: recurringCompletions }] = await Promise.all([
    supabase.from('menu_items').select('*, category:categories(*)').eq('id', id).single(),
    supabase.from('modules').select('*').eq('menu_item_id', id).order('sort_order'),
    supabase.from('module_completions').select('*').eq('trainee_id', authUser.id),
    supabase.from('completions').select('*').eq('menu_item_id', id).eq('trainee_id', authUser.id).maybeSingle(),
    supabase.from('users').select('*').eq('id', authUser.id).single(),
    supabase.from('plates').select('*').eq('menu_item_id', id).eq('trainee_id', authUser.id).order('date_assigned', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('recurring_task_completions').select('*').eq('menu_item_id', id).eq('trainee_id', authUser.id),
  ])

  if (!menuItem || !profile) redirect('/trainee')

  // Fetch sibling items in same course (category) to detect course completion
  const [{ data: siblingItems }, { data: siblingCompletions }, { data: allPlates }] = await Promise.all([
    supabase.from('menu_items').select('id, status, is_recurring, recurring_amount').eq('category_id', menuItem.category_id).eq('status', 'active'),
    supabase.from('completions').select('id, menu_item_id').eq('trainee_id', authUser.id),
    supabase.from('plates').select('*').eq('trainee_id', authUser.id).eq('menu_item_id', id),
  ])

  return (
    <CourseDetail
      menuItem={menuItem}
      modules={modules ?? []}
      moduleCompletions={moduleCompletions ?? []}
      existingCompletion={completion ?? null}
      plate={plate ?? null}
      currentUser={profile as User}
      recurringCompletions={recurringCompletions ?? []}
      siblingItems={(siblingItems ?? []) as any}
      siblingCompletions={(siblingCompletions ?? []) as any}
      allPlates={(allPlates ?? []) as any}
    />
  )
}
