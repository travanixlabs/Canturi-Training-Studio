import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = 'Canturi Training Studio <trainingstudio@canturi.com>'

export async function sendSignOffNotification({
  managerEmail,
  managerName,
  traineeName,
  taskTitle,
  breadcrumb,
  completionId,
  appUrl,
}: {
  managerEmail: string
  managerName: string
  traineeName: string
  taskTitle: string
  breadcrumb: string
  completionId: string
  appUrl: string
}) {
  const signOffUrl = `${appUrl}/manager/sign-off?completion=${completionId}`

  await resend.emails.send({
    from: FROM_EMAIL,
    to: managerEmail,
    subject: `${traineeName} completed "${taskTitle}" — pending your feedback`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 0;">
        <div style="background: #FDFBF7; border: 1px solid #e8e0d4; border-radius: 16px; padding: 32px;">
          <p style="font-size: 13px; color: #999; margin: 0 0 4px;">Canturi Training Studio</p>
          <h1 style="font-family: Georgia, serif; font-size: 22px; color: #2D2926; margin: 0 0 20px;">Task Completed</h1>

          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 20px;">
            Hi ${managerName.split(' ')[0]},<br><br>
            <strong>${traineeName}</strong> has completed a training task and it's ready for your feedback.
          </p>

          <div style="background: white; border: 1px solid #e8e0d4; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
            <p style="font-size: 15px; font-weight: 600; color: #2D2926; margin: 0 0 4px;">${taskTitle}</p>
            <p style="font-size: 11px; color: #999; margin: 0;">${breadcrumb}</p>
          </div>

          <a href="${signOffUrl}" style="display: block; text-align: center; background: #C9A96E; color: white; padding: 14px 24px; border-radius: 12px; text-decoration: none; font-size: 14px; font-weight: 600;">
            Review & Sign Off
          </a>

          <p style="font-size: 11px; color: #bbb; margin: 20px 0 0; text-align: center;">
            You're receiving this because you manage trainees at your boutique.
          </p>
        </div>
      </div>
    `,
  })
}
