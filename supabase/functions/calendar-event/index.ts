import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

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
  return data.access_token ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const { operation, job, refreshToken, eventId } = await req.json()

    if (!refreshToken) {
      return new Response(JSON.stringify({ error: 'refresh_token이 없습니다. 재로그인이 필요합니다.' }), { status: 400, headers: corsHeaders })
    }

    const accessToken = await refreshAccessToken(refreshToken)
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Google 액세스 토큰 발급 실패' }), { status: 401, headers: corsHeaders })
    }

    const event = {
      summary: `[취준] ${job.company} - ${job.role} 마감`,
      description: job.sourceUrl ? `채용공고: ${job.sourceUrl}` : '',
      start: { date: job.deadline },
      end: { date: job.deadline },
    }

    if (operation === 'create') {
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
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
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      })
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (operation === 'delete') {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
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
