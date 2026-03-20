import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CourseDetail } from '@/components/trainee/CourseDetail'
import type { User } from '@/types'

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: menuItem }, { data: modules }, { data: moduleCompletions }, { data: completion }, { data: profile }, { data: plate }] = await Promise.all([
    supabase.from('menu_items').select('*, category:categories(*)').eq('id', id).single(),
    supabase.from('modules').select('*').eq('menu_item_id', id).order('sort_order'),
    supabase.from('module_completions').select('*').eq('trainee_id', authUser.id),
    supabase.from('completions').select('*').eq('menu_item_id', id).eq('trainee_id', authUser.id).maybeSingle(),
    supabase.from('users').select('*').eq('id', authUser.id).single(),
    supabase.from('plates').select('*').eq('menu_item_id', id).eq('trainee_id', authUser.id).order('date_assigned', { ascending: false }).limit(1).maybeSingle(),
  ])

  if (!menuItem || !profile) redirect('/trainee')

  return (
    <CourseDetail
      menuItem={menuItem}
      modules={modules ?? []}
      moduleCompletions={moduleCompletions ?? []}
      existingCompletion={completion ?? null}
      plate={plate ?? null}
      currentUser={profile as User}
    />
  )
}
