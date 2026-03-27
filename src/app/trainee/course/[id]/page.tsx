import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CourseDetail } from '@/components/trainee/CourseDetail'
import type { User } from '@/types'

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: categoryItem }, { data: modules }, { data: moduleCompletions }, { data: completion }, { data: profile }, { data: plate }, { data: recurringCompletions }] = await Promise.all([
    supabase.from('categories').select('*, course:courses(*)').eq('id', id).single(),
    supabase.from('subcategories').select('*').eq('category_id', id).order('sort_order'),
    supabase.from('subcategory_completions').select('*').eq('trainee_id', authUser.id),
    supabase.from('completions').select('*').eq('category_id', id).eq('trainee_id', authUser.id).maybeSingle(),
    supabase.from('users').select('*').eq('id', authUser.id).single(),
    supabase.from('plates').select('*').eq('category_id', id).eq('trainee_id', authUser.id).order('date_assigned', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('training_task_completions').select('*').eq('category_id', id).eq('trainee_id', authUser.id),
  ])

  if (!categoryItem || !profile) redirect('/trainee')

  // Fetch sibling items in same course (category) to detect course completion
  const [{ data: siblingItems }, { data: siblingCompletions }, { data: allPlates }] = await Promise.all([
    supabase.from('categories').select('id, status, is_recurring, recurring_amount').eq('course_id', categoryItem.course_id).eq('status', 'active'),
    supabase.from('completions').select('id, category_id').eq('trainee_id', authUser.id),
    supabase.from('plates').select('*').eq('trainee_id', authUser.id).eq('category_id', id),
  ])

  return (
    <CourseDetail
      categoryItem={categoryItem}
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
