import { createClient } from '@/lib/supabase/server'
import { sendCompletionNotification } from '@/lib/email'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { completionId } = await req.json()
  if (!completionId) return NextResponse.json({ error: 'Missing completionId' }, { status: 400 })

  const supabase = await createClient()

  const { data: completion } = await supabase
    .from('training_task_completions')
    .select('*')
    .eq('id', completionId)
    .single()

  if (!completion) return NextResponse.json({ error: 'Completion not found' }, { status: 404 })

  const { data: task } = await supabase
    .from('training_tasks')
    .select('*')
    .eq('id', completion.training_task_id)
    .single()

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const { data: trainee } = await supabase
    .from('users')
    .select('*')
    .eq('id', completion.trainee_id)
    .single()

  if (!trainee) return NextResponse.json({ error: 'Trainee not found' }, { status: 404 })

  const { data: managers } = await supabase
    .from('users')
    .select('*')
    .eq('boutique_id', trainee.boutique_id)
    .eq('role', 'manager')

  if (!managers || managers.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'No managers' })
  }

  const { data: sub } = await supabase.from('subcategories').select('*').eq('id', task.subcategory_id).single()
  const { data: cat } = sub ? await supabase.from('categories').select('*, course:courses(*)').eq('id', sub.category_id).single() : { data: null }
  const courseName = cat?.course?.name ?? ''
  const breadcrumb = [courseName, cat?.title, sub?.title].filter(Boolean).join(' › ')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const signOffLink = `/manager/sign-off?completion=${completionId}`
  const isSelfDirected = task.trainer_type === 'Self Directed'
  const needsSignOff = !isSelfDirected
  const isLowCompetence = completion.confidence_rating && completion.confidence_rating <= 3

  // Skip if self-directed AND no low competence — nothing to notify
  if (isSelfDirected && !isLowCompetence) {
    return NextResponse.json({ skipped: true, reason: 'Self Directed, no low rating' })
  }

  const sent: string[] = []

  for (const manager of managers) {
    // Single email combining sign-off + low competence if both apply
    try {
      await sendCompletionNotification({
        managerEmail: manager.email,
        managerName: manager.name,
        traineeName: trainee.name,
        taskTitle: task.title,
        breadcrumb,
        completionId,
        appUrl,
        needsSignOff,
        lowCompetenceRating: isLowCompetence ? completion.confidence_rating : null,
      })
      sent.push(manager.email)
    } catch (e) {
      console.error(`Failed to email ${manager.email}:`, e)
    }

    // In-app notifications (still separate for different notification types)
    if (needsSignOff) {
      await supabase.from('user_notifications').insert({
        user_id: manager.id,
        type: 'sign_off_pending',
        title: `${trainee.name} completed a task`,
        message: `"${task.title}" is ready for your feedback.`,
        link: signOffLink,
      })
    }

    if (isLowCompetence) {
      await supabase.from('user_notifications').insert({
        user_id: manager.id,
        type: 'low_competence',
        title: `⚠ ${trainee.name} rated ${completion.confidence_rating}/5`,
        message: `Low competence on "${task.title}" — may need coaching.`,
        link: signOffLink,
      })
    }
  }

  return NextResponse.json({ sent, needsSignOff, lowCompetenceAlert: isLowCompetence })
}
