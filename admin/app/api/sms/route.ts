import twilio from 'twilio'
export async function POST(req: Request) {
  const { to, message } = await req.json()
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  await client.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to
  })
  return Response.json({ ok: true })
}
