import { createClient } from '@/lib/supabase/server'
import { sendSignOffNotification } from '@/lib/email'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { completionId } = await req.json()
  if (!completionId) return NextResponse.json({ error: 'Missing completionId' }, { status: 400 })

  const supabase = await createClient()

  // Get the completion
  const { data: completion } = await supabase
    .from('training_task_completions')
    .select('*')
    .eq('id', completionId)
    .single()

  if (!completion) return NextResponse.json({ error: 'Completion not found' }, { status: 404 })

  // Get the training task
  const { data: task } = await supabase
    .from('training_tasks')
    .select('*')
    .eq('id', completion.training_task_id)
    .single()

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  // Skip self-directed tasks
  if (task.trainer_type === 'Self Directed') {
    return NextResponse.json({ skipped: true, reason: 'Self Directed' })
  }

  // Get trainee
  const { data: trainee } = await supabase
    .from('users')
    .select('*')
    .eq('id', completion.trainee_id)
    .single()

  if (!trainee) return NextResponse.json({ error: 'Trainee not found' }, { status: 404 })

  // Get managers in the same boutique
  const { data: managers } = await supabase
    .from('users')
    .select('*')
    .eq('boutique_id', trainee.boutique_id)
    .eq('role', 'manager')

  if (!managers || managers.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'No managers' })
  }

  // Build breadcrumb
  const { data: sub } = await supabase.from('subcategories').select('*').eq('id', task.subcategory_id).single()
  const { data: cat } = sub ? await supabase.from('categories').select('*, course:courses(*)').eq('id', sub.category_id).single() : { data: null }
  const courseName = cat?.course?.name ?? ''
  const breadcrumb = [courseName, cat?.title, sub?.title].filter(Boolean).join(' › ')

  // Determine app URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  const signOffLink = `/manager/sign-off?completion=${completionId}`

  // Send email + in-app notification to each manager
  const sent: string[] = []
  for (const manager of managers) {
    try {
      await sendSignOffNotification({
        managerEmail: manager.email,
        managerName: manager.name,
        traineeName: trainee.name,
        taskTitle: task.title,
        breadcrumb,
        completionId,
        appUrl,
      })
      sent.push(manager.email)
    } catch (e) {
      console.error(`Failed to email ${manager.email}:`, e)
    }

    // In-app notification
    await supabase.from('user_notifications').insert({
      user_id: manager.id,
      type: 'sign_off_pending',
      title: `${trainee.name} completed a task`,
      message: `"${task.title}" is ready for your feedback.`,
      link: signOffLink,
    })
  }

  return NextResponse.json({ sent })
}
