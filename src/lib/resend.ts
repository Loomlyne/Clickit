type SendEmailInput = {
  to: string
  subject: string
  html: string
  text: string
}

type SendEmailResult =
  | { ok: true }
  | { ok: false; error: string }

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'Clickit Story <onboarding@resend.dev>'

export async function sendTransactionalEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY is not configured' }
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  })

  if (response.ok) {
    return { ok: true }
  }

  const body = await response.text()
  return {
    ok: false,
    error: body.slice(0, 500) || `Resend request failed with status ${response.status}`,
  }
}
