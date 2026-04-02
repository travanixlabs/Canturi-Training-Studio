import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = 'Canturi Training Studio <trainingstudio@canturi.com>'
export const BCC_LIST = ['patricia@canturi.com', 'tre.travan@canturi.com']

export async function sendCompletionNotification({
  managerEmails,
  managerNames,
  traineeName,
  taskTitle,
  breadcrumb,
  completionId,
  appUrl,
  needsSignOff,
  lowCompetenceRating,
}: {
  managerEmails: string[]
  managerNames: string[]
  traineeName: string
  taskTitle: string
  breadcrumb: string
  completionId: string
  appUrl: string
  needsSignOff: boolean
  lowCompetenceRating: number | null
}) {
  const signOffUrl = `${appUrl}/manager/sign-off?completion=${completionId}`
  const coachingUrl = `${appUrl}/manager/coaching?completion=${completionId}`
  const greeting = managerNames.length === 1 ? `Hi ${managerNames[0]}` : `Hi ${managerNames.join(' & ')}`
  const hasLowRating = lowCompetenceRating !== null
  const stars = hasLowRating ? '★'.repeat(lowCompetenceRating) + '☆'.repeat(5 - lowCompetenceRating) : ''

  // Build subject line
  let subject: string
  if (needsSignOff && hasLowRating) {
    subject = `⚠ ${traineeName} completed "${taskTitle}" — rated ${lowCompetenceRating}/5, pending feedback`
  } else if (hasLowRating) {
    subject = `⚠ Low competence rating: ${traineeName} rated ${lowCompetenceRating}/5 on "${taskTitle}"`
  } else {
    subject = `${traineeName} completed "${taskTitle}" — pending your feedback`
  }

  // Build alert banner if low rating
  const alertBanner = hasLowRating ? `
    <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 12px; padding: 14px 16px; margin-bottom: 20px;">
      <p style="font-size: 13px; color: #991B1B; margin: 0; font-weight: 600;">
        &#9888; Low Competence Alert — self-rated ${lowCompetenceRating}/5
      </p>
      <p style="font-size: 12px; color: #B91C1C; margin: 4px 0 0;">
        This may require additional coaching or support.
      </p>
    </div>
  ` : ''

  // Build rating display
  const ratingDisplay = hasLowRating ? `
    <p style="font-size: 20px; color: #C9A96E; margin: 8px 0 0; letter-spacing: 2px;">${stars}</p>
  ` : ''

  await resend.emails.send({
    from: FROM_EMAIL,
    to: managerEmails,
    bcc: BCC_LIST,
    subject,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 0;">
        <div style="background: #FDFBF7; border: 1px solid #e8e0d4; border-radius: 16px; padding: 32px;">
          <p style="font-size: 13px; color: #999; margin: 0 0 4px;">Canturi Training Studio</p>
          <h1 style="font-family: Georgia, serif; font-size: 22px; color: #2D2926; margin: 0 0 20px;">Task Completed</h1>

          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 20px;">
            ${greeting},<br><br>
            <strong>${traineeName}</strong> has completed a training task${needsSignOff ? ' and it\'s ready for your feedback' : ''}.
          </p>

          ${alertBanner}

          <div style="background: white; border: 1px solid #e8e0d4; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
            <p style="font-size: 15px; font-weight: 600; color: #2D2926; margin: 0 0 4px;">${taskTitle}</p>
            <p style="font-size: 11px; color: #999; margin: 0;">${breadcrumb}</p>
            ${ratingDisplay}
          </div>

          ${needsSignOff ? `
          <a href="${signOffUrl}" style="display: block; text-align: center; background: #C9A96E; color: white; padding: 14px 24px; border-radius: 12px; text-decoration: none; font-size: 14px; font-weight: 600; margin-bottom: ${hasLowRating ? '8px' : '0'};">
            Review & Sign Off
          </a>
          ` : ''}
          ${hasLowRating ? `
          <a href="${coachingUrl}" style="display: block; text-align: center; background: ${needsSignOff ? '#555' : '#C9A96E'}; color: white; padding: 14px 24px; border-radius: 12px; text-decoration: none; font-size: 14px; font-weight: 600;">
            Review in Coaching
          </a>
          ` : ''}

          <p style="font-size: 11px; color: #bbb; margin: 20px 0 0; text-align: center;">
            You're receiving this because you manage trainees at your boutique.
          </p>
        </div>
      </div>
    `,
  })
}
