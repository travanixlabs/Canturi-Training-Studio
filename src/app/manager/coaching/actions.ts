'use server'

import { createClient } from '@/lib/supabase/server'

export async function coachingAddToPlate(completionId: string, traineeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get the completion to find the training_task_id
  const { data: completion } = await supabase
    .from('training_task_completions')
    .select('*')
    .eq('id', completionId)
    .single()

  if (!completion) return { error: 'Completion not found' }

  // Mark completion as reset (keeps original data, trainee needs to redo)
  const { error: updateError } = await supabase
    .from('training_task_completions')
    .update({
      coaching_status: 'added_to_plate',
      coaching_reviewed_at: new Date().toISOString(),
      reset_at: new Date().toISOString(),
    })
    .eq('id', completionId)

  if (updateError) return { error: updateError.message }

  // Find next available working date (not today) with capacity < 10
  const todayParts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const todayKey = `${todayParts.find(p => p.type === 'year')!.value}-${todayParts.find(p => p.type === 'month')!.value}-${todayParts.find(p => p.type === 'day')!.value}`

  // Get working days after today
  const { data: workingDays } = await supabase
    .from('users_working_days')
    .select('working_date')
    .eq('user_id', traineeId)
    .gt('working_date', todayKey)
    .order('working_date')

  if (!workingDays || workingDays.length === 0) {
    return { error: 'No future working days found for this trainee' }
  }

  // Get existing assignments for these dates
  const dates = workingDays.map(w => w.working_date)
  const { data: existingAssignments } = await supabase
    .from('training_task_assigned')
    .select('assigned_date')
    .eq('trainee_id', traineeId)
    .in('assigned_date', dates)

  // Count assignments per date
  const countByDate = new Map<string, number>()
  for (const a of (existingAssignments ?? [])) {
    countByDate.set(a.assigned_date, (countByDate.get(a.assigned_date) ?? 0) + 1)
  }

  // Find first date with capacity
  let targetDate: string | null = null
  for (const wd of workingDays) {
    const count = countByDate.get(wd.working_date) ?? 0
    if (count < 10) {
      targetDate = wd.working_date
      break
    }
  }

  if (!targetDate) return { error: 'No working days with available capacity' }

  // Assign the task
  await supabase.from('training_task_assigned').insert({
    trainee_id: traineeId,
    training_task_id: completion.training_task_id,
    assigned_date: targetDate,
    assigned_by: user.id,
  })

  return { success: true, assignedDate: targetDate }
}

export async function coachingNotNow(completionId: string, traineeId: string) {
  const supabase = await createClient()

  // Get the trainee's working days to calculate 5th working day from today
  const todayParts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const todayKey = `${todayParts.find(p => p.type === 'year')!.value}-${todayParts.find(p => p.type === 'month')!.value}-${todayParts.find(p => p.type === 'day')!.value}`

  const { data: workingDays } = await supabase
    .from('users_working_days')
    .select('working_date')
    .eq('user_id', traineeId)
    .gt('working_date', todayKey)
    .order('working_date')
    .limit(5)

  // 5th working day, or 14 calendar days if not enough working days
  const reviewDate = workingDays && workingDays.length >= 5
    ? workingDays[4].working_date
    : (() => {
      const d = new Date()
      d.setDate(d.getDate() + 14)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })()

  const { error } = await supabase
    .from('training_task_completions')
    .update({
      coaching_status: 'not_now',
      coaching_not_now_until: reviewDate,
      coaching_reviewed_at: new Date().toISOString(),
    })
    .eq('id', completionId)

  if (error) return { error: error.message }
  return { success: true, reviewDate }
}

export async function coachingDismiss(completionId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('training_task_completions')
    .update({
      coaching_status: 'dismissed',
      coaching_reviewed_at: new Date().toISOString(),
    })
    .eq('id', completionId)

  if (error) return { error: error.message }
  return { success: true }
}
