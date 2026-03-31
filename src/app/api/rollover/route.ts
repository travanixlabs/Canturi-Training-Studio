import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export async function POST() {
  const supabase = await createClient()

  const todayKey = toDateKey(new Date())

  // Get all assignments for today
  const { data: todayAssignments } = await supabase
    .from('training_task_assigned')
    .select('*')
    .eq('assigned_date', todayKey)

  if (!todayAssignments || todayAssignments.length === 0) {
    return NextResponse.json({ message: 'No assignments for today', moved: 0 })
  }

  // Get all completions for today
  const { data: allCompletions } = await supabase
    .from('training_task_completions')
    .select('*')

  // Group today's assignments by trainee
  const byTrainee = new Map<string, typeof todayAssignments>()
  for (const a of todayAssignments) {
    if (!byTrainee.has(a.trainee_id)) byTrainee.set(a.trainee_id, [])
    byTrainee.get(a.trainee_id)!.push(a)
  }

  let totalMoved = 0

  for (const [traineeId, assignments] of byTrainee) {
    // Find incomplete tasks for this trainee today
    const traineeCompletions = (allCompletions ?? []).filter(c => c.trainee_id === traineeId)

    const incompleteTasks = assignments.filter(a => {
      // Check if this specific task has a completion on today's date
      const completedToday = traineeCompletions.some(
        c => c.training_task_id === a.training_task_id && c.completed_at.split('T')[0] === todayKey
      )
      return !completedToday
    })

    if (incompleteTasks.length === 0) continue

    // Get all future assignments for this trainee (dates after today)
    const { data: futureAssignments } = await supabase
      .from('training_task_assigned')
      .select('*')
      .eq('trainee_id', traineeId)
      .gt('assigned_date', todayKey)
      .order('assigned_date')

    if (!futureAssignments || futureAssignments.length === 0) continue

    // Group future assignments by date and calculate capacity
    const futureDates = new Map<string, string[]>()
    for (const a of futureAssignments) {
      if (!futureDates.has(a.assigned_date)) futureDates.set(a.assigned_date, [])
      futureDates.get(a.assigned_date)!.push(a.training_task_id)
    }

    // Sort dates chronologically
    const sortedDates = [...futureDates.entries()].sort((a, b) => a[0].localeCompare(b[0]))

    // Distribute incomplete tasks to future dates with capacity
    const tasksToDistribute = [...incompleteTasks]
    const assignedBy = incompleteTasks[0].assigned_by // preserve original manager

    for (const [date, existingTaskIds] of sortedDates) {
      if (tasksToDistribute.length === 0) break

      const capacity = 6 - existingTaskIds.length
      if (capacity <= 0) continue

      const batch = tasksToDistribute.splice(0, capacity)

      // Filter out tasks already assigned on this date
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

    // Remove the incomplete tasks from today
    const movedTaskIds = incompleteTasks
      .filter(a => !tasksToDistribute.includes(a))
      .map(a => a.id)

    if (movedTaskIds.length > 0) {
      await supabase.from('training_task_assigned').delete().in('id', movedTaskIds)
    }
  }

  return NextResponse.json({ message: `Rollover complete`, moved: totalMoved, date: todayKey })
}
