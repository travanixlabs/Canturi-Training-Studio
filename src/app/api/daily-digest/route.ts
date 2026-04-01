import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

function toDateKeyAEDT() {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find(p => p.type === 'year')!.value
  const month = parts.find(p => p.type === 'month')!.value
  const day = parts.find(p => p.type === 'day')!.value
  return `${year}-${month}-${day}`
}

function formatDateDisplay(dateKey: string) {
  const d = new Date(dateKey + 'T00:00:00')
  return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export async function POST() {
  const supabase = await createClient()
  const todayKey = toDateKeyAEDT()

  // Get all assignments for today
  const { data: todayAssignments } = await supabase
    .from('training_task_assigned')
    .select('*')
    .eq('assigned_date', todayKey)

  if (!todayAssignments || todayAssignments.length === 0) {
    return NextResponse.json({ message: 'No assignments for today', sent: 0 })
  }

  // Get all trainees who have assignments today
  const traineeIds = [...new Set(todayAssignments.map(a => a.trainee_id))]

  const { data: trainees } = await supabase
    .from('users')
    .select('*')
    .in('id', traineeIds)

  if (!trainees || trainees.length === 0) {
    return NextResponse.json({ message: 'No trainees found', sent: 0 })
  }

  // Get all training tasks
  const taskIds = [...new Set(todayAssignments.map(a => a.training_task_id))]
  const { data: tasks } = await supabase
    .from('training_tasks')
    .select('*')
    .in('id', taskIds)

  const taskMap = new Map((tasks ?? []).map(t => [t.id, t]))

  // Get subcategories, categories, courses for breadcrumbs
  const { data: subcategories } = await supabase.from('subcategories').select('*').is('deleted_at', null)
  const { data: categories } = await supabase.from('categories').select('*, course:courses(*)').is('deleted_at', null)

  function getBreadcrumb(taskId: string) {
    const task = taskMap.get(taskId)
    if (!task) return ''
    const sub = (subcategories ?? []).find((s: { id: string }) => s.id === task.subcategory_id)
    const cat = sub ? (categories ?? []).find((c: { id: string }) => c.id === sub.category_id) : null
    const courseName = cat?.course?.name ?? ''
    return [courseName, cat?.title, sub?.title].filter(Boolean).join(' › ')
  }

  // Get all managers grouped by boutique
  const boutiqueIds = [...new Set(trainees.map(t => t.boutique_id))]
  const { data: managers } = await supabase
    .from('users')
    .select('*')
    .in('boutique_id', boutiqueIds)
    .eq('role', 'manager')

  const managersByBoutique = new Map<string, string[]>()
  for (const m of (managers ?? [])) {
    if (!managersByBoutique.has(m.boutique_id)) managersByBoutique.set(m.boutique_id, [])
    managersByBoutique.get(m.boutique_id)!.push(m.email)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  let sentCount = 0

  for (const trainee of trainees) {
    const traineeAssignments = todayAssignments.filter(a => a.trainee_id === trainee.id)
    if (traineeAssignments.length === 0) continue

    const taskRows = traineeAssignments.map(a => {
      const task = taskMap.get(a.training_task_id)
      if (!task) return ''
      const breadcrumb = getBreadcrumb(task.id)
      const isRecurring = task.is_recurring
      return `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f0ebe3;">
            <p style="font-size: 14px; font-weight: 500; color: #2D2926; margin: 0;">${task.title}</p>
            <p style="font-size: 11px; color: #999; margin: 2px 0 0;">${breadcrumb}</p>
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f0ebe3; text-align: right; white-space: nowrap;">
            ${isRecurring
              ? '<span style="font-size: 10px; background: #EFF6FF; color: #2563EB; padding: 2px 8px; border-radius: 10px;">Shadow</span>'
              : '<span style="font-size: 10px; background: #f5f5f4; color: #999; padding: 2px 8px; border-radius: 10px;">Task</span>'
            }
          </td>
        </tr>
      `
    }).filter(Boolean).join('')

    const ccEmails = managersByBoutique.get(trainee.boutique_id) ?? []

    try {
      await resend.emails.send({
        from: 'Canturi Training Studio <trainingstudio@canturi.com>',
        to: trainee.email,
        cc: ccEmails.length > 0 ? ccEmails : undefined,
        subject: `Your training for today — ${formatDateDisplay(todayKey)}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 0;">
            <div style="background: #FDFBF7; border: 1px solid #e8e0d4; border-radius: 16px; padding: 32px;">
              <p style="font-size: 13px; color: #999; margin: 0 0 4px;">Canturi Training Studio</p>
              <h1 style="font-family: Georgia, serif; font-size: 22px; color: #2D2926; margin: 0 0 6px;">Good morning, ${trainee.name.split(' ')[0]}</h1>
              <p style="font-size: 14px; color: #555; margin: 0 0 24px;">
                Here's your training for <strong>${formatDateDisplay(todayKey)}</strong>
              </p>

              <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #e8e0d4; border-radius: 12px; overflow: hidden;">
                <thead>
                  <tr>
                    <th style="text-align: left; font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.05em; padding: 10px 12px; border-bottom: 1px solid #e8e0d4;">Training Task</th>
                    <th style="text-align: right; font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.05em; padding: 10px 12px; border-bottom: 1px solid #e8e0d4;">Type</th>
                  </tr>
                </thead>
                <tbody>
                  ${taskRows}
                </tbody>
              </table>

              <p style="font-size: 13px; color: #555; margin: 24px 0 16px; text-align: center;">
                ${traineeAssignments.length} task${traineeAssignments.length !== 1 ? 's' : ''} assigned for today
              </p>

              <a href="${appUrl}/trainee/day-plate" style="display: block; text-align: center; background: #C9A96E; color: white; padding: 14px 24px; border-radius: 12px; text-decoration: none; font-size: 14px; font-weight: 600;">
                Open Day Plate
              </a>

              <p style="font-size: 11px; color: #bbb; margin: 20px 0 0; text-align: center;">
                You're receiving this because you have training tasks assigned for today.
              </p>
            </div>
          </div>
        `,
      })
      sentCount++
    } catch (e) {
      console.error(`Failed to send digest to ${trainee.email}:`, e)
    }
  }

  return NextResponse.json({ message: 'Daily digest sent', sent: sentCount, date: todayKey })
}
