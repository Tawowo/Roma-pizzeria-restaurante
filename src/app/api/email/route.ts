import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const resend = new Resend('re_fKNfkhxL_88xFyednhBqBy24b43Vh29xV')

export async function POST(req: Request) {
  const { to, subject, html } = await req.json()
  if (!to || !subject || !html) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  try {
    const { data, error } = await resend.emails.send({
      from: 'Roma Pizzeria <onboarding@resend.dev>',
      to,
      subject,
      html
    })
    if (error) return NextResponse.json({ error }, { status: 400 })
    return NextResponse.json({ ok: true, data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
