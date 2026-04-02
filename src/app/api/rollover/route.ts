import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function toDateKeyAEST() {
  // Use Australia/Sydney timezone to determine "today"
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find(p => p.type === 'year')!.value
  const month = parts.find(p => p.type === 'month')!.value
  const day = parts.find(p => p.type === 'day')!.value
  return `${year}-${month}-${day}`
}

export async function POST() {
  const supabase = await createClient()

  const todayKey = toDateKeyAEST()

  // Get all assignments for today and past dates (anything before tomorrow)
  const { data: pastAndTodayAssignments } = await supabase
    .from('training_task_assigned')
    .select('*')
    .lte('assigned_date', todayKey)

  if (!pastAndTodayAssignments || pastAndTodayAssignments.length === 0) {
    return NextResponse.json({ message: 'No assignments to process', moved: 0 })
  }

  // Get all completions
  const { data: allCompletions } = await supabase
    .from('training_task_completions')
    .select('*')

  // Group assignments by trainee
  const byTrainee = new Map<string, typeof pastAndTodayAssignments>()
  for (const a of pastAndTodayAssignments) {
    if (!byTrainee.has(a.trainee_id)) byTrainee.set(a.trainee_id, [])
    byTrainee.get(a.trainee_id)!.push(a)
  }

  let totalMoved = 0
  const processedDates: string[] = []

  for (const [traineeId, assignments] of byTrainee) {
    const traineeCompletions = (allCompletions ?? []).filter(c => c.trainee_id === traineeId)

    // Find incomplete tasks across all past/today dates
    const incompleteTasks = assignments.filter(a => {
      const completedOnDate = traineeCompletions.some(
        c => c.training_task_id === a.training_task_id && c.completed_at.split('T')[0] === a.assigned_date
      )
      return !completedOnDate
    })

    // Only process tasks from dates strictly before today (past dates)
    // Today's tasks stay — they still have time to complete them
    const pastIncompleteTasks = incompleteTasks.filter(a => a.assigned_date < todayKey)

    if (pastIncompleteTasks.length === 0) continue

    // Get all assignments for this trainee from today onwards (including today)
    const { data: futureAssignments } = await supabase
      .from('training_task_assigned')
      .select('*')
      .eq('trainee_id', traineeId)
      .gte('assigned_date', todayKey)
      .order('assigned_date')

    // Group future assignments by date
    const futureDates = new Map<string, string[]>()
    for (const a of (futureAssignments ?? [])) {
      if (!futureDates.has(a.assigned_date)) futureDates.set(a.assigned_date, [])
      futureDates.get(a.assigned_date)!.push(a.training_task_id)
    }

    // Get working days for this trainee from today onwards
    const { data: workingDaysData } = await supabase
      .from('users_working_days')
      .select('working_date')
      .eq('user_id', traineeId)
      .gte('working_date', todayKey)
      .order('working_date')

    const workingDatesSet = new Set((workingDaysData ?? []).map((w: { working_date: string }) => w.working_date))

    // Build list of target dates: only working days, up to 28 days ahead
    const targetDates: { date: string; existing: string[] }[] = []
    for (let i = 0; i < 28; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (!workingDatesSet.has(dk)) continue // skip non-working days
      targetDates.push({ date: dk, existing: futureDates.get(dk) ?? [] })
    }

    // Distribute past incomplete tasks to dates with capacity
    const tasksToDistribute = [...pastIncompleteTasks]
    const assignedBy = pastIncompleteTasks[0].assigned_by

    for (const { date, existing: existingTaskIds } of targetDates) {
      if (tasksToDistribute.length === 0) break

      const capacity = 10 - existingTaskIds.length
      if (capacity <= 0) continue

      const batch = tasksToDistribute.splice(0, capacity)
      const toInsert = batch.filter(a => !existingTaskIds.includes(a.training_task_id))

      if (toInsert.length > 0) {
        await supabase.from('training_task_assigned').insert(
          toInsert.map(a => ({
            trainee_id: traineeId,
            training_task_id: a.training_task_id,
            assigned_date: date,
            assigned_by: assignedBy,
          }))
        )
        totalMoved += toInsert.length
      }
    }

    // Remove all past incomplete tasks — moved ones go to new dates, unplaced ones are unassigned
    const allPastIds = pastIncompleteTasks.map(a => a.id)
    if (allPastIds.length > 0) {
      await supabase.from('training_task_assigned').delete().in('id', allPastIds)
      processedDates.push(...new Set(pastIncompleteTasks.map(a => a.assigned_date)))
    }
  }

  // === Coaching "Not Now" retrigger ===
  // Find completions where coaching_not_now_until <= today and status is 'not_now'
  const { data: notNowItems } = await supabase
    .from('training_task_completions')
    .select('*, training_task:training_tasks(*)')
    .eq('coaching_status', 'not_now')
    .lte('coaching_not_now_until', todayKey)

  let retriggered = 0
  if (notNowItems && notNowItems.length > 0) {
    // Set them back to pending
    const ids = notNowItems.map(c => c.id)
    await supabase.from('training_task_completions').update({
      coaching_status: 'pending',
      coaching_not_now_until: null,
    }).in('id', ids)
    retriggered = ids.length

    // Group by trainee to find managers and send notifications
    const traineeIds = [...new Set(notNowItems.map(c => c.trainee_id))]
    for (const traineeId of traineeIds) {
      const { data: trainee } = await supabase.from('users').select('*').eq('id', traineeId).single()
      if (!trainee) continue
      const { data: managers } = await supabase.from('users').select('*').eq('boutique_id', trainee.boutique_id).eq('role', 'manager')
      if (!managers || managers.length === 0) continue

      const traineeItems = notNowItems.filter(c => c.trainee_id === traineeId)
      for (const manager of managers) {
        for (const item of traineeItems) {
          await supabase.from('user_notifications').insert({
            user_id: manager.id,
            type: 'coaching_review',
            title: `Coaching review: ${trainee.name}`,
            message: `"${item.training_task?.title ?? 'Task'}" is ready for your review again.`,
            link: '/manager/coaching',
          })
        }
      }
    }
  }

  return NextResponse.json({ message: 'Rollover complete', moved: totalMoved, processedDates, retriggered, date: todayKey })
}
