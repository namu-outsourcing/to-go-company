import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function buildEmailHTML(urgent: any[], soon: any[], upcoming: any[]): string {
  const section = (title: string, emoji: string, color: string, jobs: any[]) => {
    if (jobs.length === 0) return ''
    const items = jobs.map(j => `
      <tr>
        <td style="padding:10px 0; border-bottom:1px solid #f1f5f9;">
          <strong style="color:#0f172a;">${j.company}</strong>
          <span style="color:#64748b; margin-left:8px;">${j.role}</span>
        </td>
        <td style="padding:10px 0; border-bottom:1px solid #f1f5f9; text-align:right;">
          <span style="color:${color}; font-weight:700;">${j.deadline}</span>
        </td>
      </tr>`).join('')
    return `
      <div style="margin-bottom:24px;">
        <div style="background:${color}18; border-left:4px solid ${color}; padding:10px 16px; border-radius:0 8px 8px 0; margin-bottom:12px;">
          <strong style="color:${color}; font-size:15px;">${emoji} ${title}</strong>
        </div>
        <table style="width:100%; border-collapse:collapse;">${items}</table>
      </div>`
  }

  return `
    <div style="font-family:'Apple SD Gothic Neo',sans-serif; max-width:600px; margin:0 auto; background:#fff; padding:40px; border-radius:16px; border:1px solid #e2e8f0;">
      <div style="text-align:center; margin-bottom:32px;">
        <h1 style="font-size:24px; color:#0f172a; margin:0;">📋 취업 공고 마감 리포트</h1>
        <p style="color:#64748b; margin-top:8px; font-size:14px;">${formatDate(new Date())} 기준</p>
      </div>
      ${section('D-1 긴급 마감', '🔴', '#ef4444', urgent)}
      ${section('D-3 마감 임박', '🟠', '#f97316', soon)}
      ${section('D-7 마감 예정', '🟡', '#eab308', upcoming)}
      <div style="margin-top:32px; padding-top:24px; border-top:1px solid #e2e8f0; text-align:center;">
        <a href="https://to-go-company.vercel.app" style="background:#2563eb; color:#fff; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:600; font-size:15px;">Career Log 열기</a>
      </div>
      <p style="color:#94a3b8; font-size:12px; text-align:center; margin-top:24px;">취업 준비 AI 에이전트 · Career Log</p>
    </div>`
}

function daysUntil(deadline: string, today: Date): number {
  const d = new Date(deadline)
  d.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - today.getTime()) / 86400000)
}

Deno.serve(async () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: rows, error } = await supabase.from('user_data').select('user_id, jobs')
  if (error) return new Response('DB error: ' + error.message, { status: 500 })

  console.log(`[DEBUG] rows count: ${rows?.length}`)

  for (const row of rows || []) {
    const jobs: any[] = row.jobs || []
    const active = jobs.filter(j => j.status !== 'fail' && j.status !== 'pass' && j.deadline && j.deadline !== '상시모집')

    console.log(`[DEBUG] user: ${row.user_id}, active jobs: ${active.length}`)
    active.forEach(j => console.log(`[DEBUG] job: ${j.company} deadline: ${j.deadline} days: ${daysUntil(j.deadline, today)}`))

    const urgent   = active.filter(j => daysUntil(j.deadline, today) === 1)
    const soon     = active.filter(j => { const d = daysUntil(j.deadline, today); return d >= 2 && d <= 3 })
    const upcoming = active.filter(j => { const d = daysUntil(j.deadline, today); return d >= 4 && d <= 7 })

    console.log(`[DEBUG] urgent: ${urgent.length}, soon: ${soon.length}, upcoming: ${upcoming.length}`)

    if (urgent.length + soon.length + upcoming.length === 0) continue

    const { data: adminData, error: adminError } = await supabase.auth.admin.getUserById(row.user_id)
    console.log(`[DEBUG] user email: ${adminData?.user?.email}, error: ${adminError?.message}`)
    if (!adminData?.user?.email) continue

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Career Log <onboarding@resend.dev>',
        to: adminData.user.email,
        subject: `📋 오늘의 취업 마감 리포트 - ${urgent.length + soon.length + upcoming.length}개 공고 확인`,
        html: buildEmailHTML(urgent, soon, upcoming),
      }),
    })
    const emailJson = await emailRes.json()
    console.log(`[DEBUG] resend response: ${JSON.stringify(emailJson)}`)
  }

  return new Response('Done', { status: 200 })
})
