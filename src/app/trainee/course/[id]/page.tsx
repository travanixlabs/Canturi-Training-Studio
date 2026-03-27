import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CourseDetail } from '@/components/trainee/CourseDetail'
import type { User } from '@/types'

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: categoryItem }, { data: completion }, { data: profile }, { data: plate }] = await Promise.all([
    supabase.from('categories').select('*, course:courses(*)').eq('id', id).single(),
    supabase.from('completions').select('*').eq('category_id', id).eq('trainee_id', authUser.id).maybeSingle(),
    supabase.from('users').select('*').eq('id', authUser.id).single(),
    supabase.from('plates').select('*').eq('category_id', id).eq('trainee_id', authUser.id).order('date_assigned', { ascending: false }).limit(1).maybeSingle(),
  ])

  if (!categoryItem || !profile) redirect('/trainee')

  // Fetch sibling items in same course (category) to detect course completion
  const [{ data: siblingItems }, { data: siblingCompletions }] = await Promise.all([
    supabase.from('categories').select('id, status').eq('course_id', categoryItem.course_id).eq('status', 'active'),
    supabase.from('completions').select('id, category_id').eq('trainee_id', authUser.id),
  ])

  return (
    <CourseDetail
      categoryItem={categoryItem}
      existingCompletion={completion ?? null}
      plate={plate ?? null}
      currentUser={profile as User}
      siblingItems={(siblingItems ?? []) as any}
      siblingCompletions={(siblingCompletions ?? []) as any}
    />
  )
}
