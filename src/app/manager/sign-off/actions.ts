'use server'

import { createClient } from '@/lib/supabase/server'

export async function signOffCompletion(
  completionId: string,
  data: { manager_notes: string; manager_coaching: string; manager_rating: number }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: updated, error } = await supabase.from('training_task_completions').update({
    manager_notes: data.manager_notes,
    manager_coaching: data.manager_coaching,
    manager_rating: data.manager_rating,
    signed_off_at: new Date().toISOString(),
    signed_off_by: user.id,
  }).eq('id', completionId).select()

  if (error) return { error: error.message }
  if (!updated || updated.length === 0) return { error: 'No rows updated — check RLS policies on training_task_completions' }
  return { success: true }
}
