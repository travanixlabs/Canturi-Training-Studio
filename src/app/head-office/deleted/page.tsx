import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DeletionHistory } from '@/components/headoffice/DeletionHistory'

export default async function DeletionHistoryPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: workshops }, { data: categories }, { data: subcategories }, { data: trainingTasks }, { data: taskContent }] = await Promise.all([
    supabase.from('workshops').select('id, name, deleted_at').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    supabase.from('categories').select('id, title, deleted_at').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    supabase.from('subcategories').select('id, title, deleted_at').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    supabase.from('training_tasks').select('id, title, deleted_at').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    supabase.from('training_task_content').select('id, title, url, deleted_at').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
  ])

  type DeletedItem = { id: string; table: string; label: string; detail: string; deleted_at: string }

  const items: DeletedItem[] = [
    ...(workshops ?? []).map(w => ({ id: w.id, table: 'workshops', label: 'Workshop', detail: w.name, deleted_at: w.deleted_at })),
    ...(categories ?? []).map(c => ({ id: c.id, table: 'categories', label: 'Category', detail: c.title, deleted_at: c.deleted_at })),
    ...(subcategories ?? []).map(s => ({ id: s.id, table: 'subcategories', label: 'Subcategory', detail: s.title, deleted_at: s.deleted_at })),
    ...(trainingTasks ?? []).map(t => ({ id: t.id, table: 'training_tasks', label: 'Training Task', detail: t.title, deleted_at: t.deleted_at })),
    ...(taskContent ?? []).map(c => ({ id: c.id, table: 'training_task_content', label: 'Content', detail: c.title || c.url, deleted_at: c.deleted_at })),
  ].sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime())

  return <DeletionHistory items={items} />
}
