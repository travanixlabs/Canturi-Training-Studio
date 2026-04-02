import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { BCC_LIST } from '@/lib/email'
import { NextRequest, NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { taskId, taskTitle, breadcrumb, issue } = await req.json()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: manager } = await supabase.from('users').select('*').eq('id', user.id).single()
  const managerName = manager?.name ?? 'A manager'

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const taskLink = `${appUrl}/head-office/courses`

  await resend.emails.send({
    from: 'Canturi Training Studio <trainingstudio@canturi.com>',
    to: 'IT@canturi.com',
    bcc: BCC_LIST,
    subject: `Issue reported: "${taskTitle}"`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 0;">
        <div style="background: #FDFBF7; border: 1px solid #e8e0d4; border-radius: 16px; padding: 32px;">
          <p style="font-size: 13px; color: #999; margin: 0 0 4px;">Canturi Training Studio</p>
          <h1 style="font-family: Georgia, serif; font-size: 22px; color: #2D2926; margin: 0 0 20px;">
            <span style="color: #F59E0B;">&#9888;</span> Issue Reported
          </h1>

          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 20px;">
            <strong>${managerName}</strong> has reported an issue with a training task.
          </p>

          <div style="background: white; border: 1px solid #e8e0d4; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
            <p style="font-size: 15px; font-weight: 600; color: #2D2926; margin: 0 0 4px;">${taskTitle}</p>
            <p style="font-size: 11px; color: #999; margin: 0;">${breadcrumb}</p>
          </div>

          <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
            <p style="font-size: 11px; color: #92400E; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 6px; font-weight: 600;">Issue Description</p>
            <p style="font-size: 14px; color: #78350F; line-height: 1.6; margin: 0; white-space: pre-wrap;">${issue}</p>
          </div>

          <a href="${taskLink}" style="display: block; text-align: center; background: #C9A96E; color: white; padding: 14px 24px; border-radius: 12px; text-decoration: none; font-size: 14px; font-weight: 600;">
            Open Course Editor
          </a>

          <p style="font-size: 11px; color: #bbb; margin: 20px 0 0; text-align: center;">
            Task ID: ${taskId}
          </p>
        </div>
      </div>
    `,
  })

  // In-app notification for IT user
  const { data: itUser } = await supabase.from('users').select('id').eq('email', 'it@canturi.com').single()
  if (itUser) {
    await supabase.from('user_notifications').insert({
      user_id: itUser.id,
      type: 'report_issue',
      title: `⚠ ${managerName} reported an issue`,
      message: `"${taskTitle}" — ${issue}`,
      link: '/head-office/courses',
    })
  }

  return NextResponse.json({ success: true })
}
