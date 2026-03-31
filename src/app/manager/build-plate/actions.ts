'use server'

import { createClient } from '@/lib/supabase/server'

export async function savePlateAssignments(
  traineeId: string,
  assignments: Record<string, string[]> // "YYYY-MM-DD" -> task IDs
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { saved: [] as string[], errors: { _auth: 'Not authenticated' } }

  const saved: string[] = []
  const errors: Record<string, string> = {}

  for (const [date, taskIds] of Object.entries(assignments)) {
    if (taskIds.length < 3 || taskIds.length > 6) {
      errors[date] = `Must have 3–6 tasks (has ${taskIds.length})`
      continue
    }

    // Delete existing for this trainee+date, then insert new
    await supabase.from('training_task_assigned').delete().eq('trainee_id', traineeId).eq('assigned_date', date)

    const { error } = await supabase.from('training_task_assigned').insert(
      taskIds.map(taskId => ({
        trainee_id: traineeId,
        training_task_id: taskId,
        assigned_date: date,
        assigned_by: user.id,
      }))
    )

    if (error) errors[date] = error.message
    else saved.push(date)
  }

  return { saved, errors }
}
