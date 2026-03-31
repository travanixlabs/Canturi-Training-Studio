import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export async function POST() {
  const supabase = await createClient()

  const todayKey = toDateKey(new Date())

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

    // Get all future assignments for this trainee (dates after today)
    const { data: futureAssignments } = await supabase
      .from('training_task_assigned')
      .select('*')
      .eq('trainee_id', traineeId)
      .gt('assigned_date', todayKey)
      .order('assigned_date')

    if (!futureAssignments || futureAssignments.length === 0) continue

    // Group future assignments by date
    const futureDates = new Map<string, string[]>()
    for (const a of futureAssignments) {
      if (!futureDates.has(a.assigned_date)) futureDates.set(a.assigned_date, [])
      futureDates.get(a.assigned_date)!.push(a.training_task_id)
    }

    const sortedDates = [...futureDates.entries()].sort((a, b) => a[0].localeCompare(b[0]))

    // Distribute past incomplete tasks to future dates with capacity
    const tasksToDistribute = [...pastIncompleteTasks]
    const assignedBy = pastIncompleteTasks[0].assigned_by

    for (const [date, existingTaskIds] of sortedDates) {
      if (tasksToDistribute.length === 0) break

      const capacity = 6 - existingTaskIds.length
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

    // Remove moved tasks from their original past dates
    const movedTaskIds = pastIncompleteTasks
      .filter(a => !tasksToDistribute.includes(a))
      .map(a => a.id)

    if (movedTaskIds.length > 0) {
      await supabase.from('training_task_assigned').delete().in('id', movedTaskIds)
      processedDates.push(...new Set(pastIncompleteTasks.map(a => a.assigned_date)))
    }
  }

  return NextResponse.json({ message: 'Rollover complete', moved: totalMoved, processedDates, date: todayKey })
}
