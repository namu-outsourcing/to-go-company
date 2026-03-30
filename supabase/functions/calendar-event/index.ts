import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const CALENDAR_NAME = 'career log'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) {
    console.error('Token refresh failed:', JSON.stringify(data))
    return null
  }
  return data.access_token
}

async function getOrCreateCalendar(accessToken: string): Promise<string> {
  // 캘린더 목록 조회
  const listRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  
  if (!listRes.ok) {
    const err = await listRes.text()
    console.error('calendarList error:', err)
    throw new Error('Google Calendar List 조회 실패')
  }

  const listData = await listRes.json()
  const existing = (listData.items ?? []).find((c: any) => c.summary === CALENDAR_NAME)
  if (existing) return existing.id

  // 없으면 새로 생성
  console.log(`Creating new calendar: ${CALENDAR_NAME}`)
  const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: CALENDAR_NAME }),
  })
  
  if (!createRes.ok) {
    const err = await createRes.text()
    console.error('calendar create error:', err)
    throw new Error('Google Calendar 생성 실패')
  }

  const created = await createRes.json()
  return created.id
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return new Response(JSON.stringify({ error: 'Unauthorized', detail: error?.message }), { status: 401, headers: corsHeaders })

    const { operation, job, refreshToken, eventId } = await req.json()

    if (!refreshToken) {
      return new Response(JSON.stringify({ error: 'refresh_token이 없습니다. 재로그인이 필요합니다.' }), { status: 400, headers: corsHeaders })
    }

    const accessToken = await refreshAccessToken(refreshToken)
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Google 액세스 토큰 발급 실패', hint: 'Edge Function 로그 확인' }), { status: 401, headers: corsHeaders })
    }

    const calendarId = await getOrCreateCalendar(accessToken)

    const event = {
      summary: `[취준] ${job.company} - ${job.role} 마감`,
      description: job.sourceUrl ? `채용공고: ${job.sourceUrl}` : '',
      start: { date: job.deadline },
      end: { date: job.deadline },
    }

    if (operation === 'create') {
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      })
      const data = await res.json()
      return new Response(JSON.stringify({ eventId: data.id ?? null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (operation === 'update') {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      })
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (operation === 'delete') {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid operation' }), { status: 400, headers: corsHeaders })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
