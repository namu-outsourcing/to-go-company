import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  })
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return new Response('Unauthorized', { status: 401 })

  const { text } = await req.json()

  const prompt = `제공된 한국어 자소서 텍스트의 맞춤법, 띄어쓰기, 오탈자를 교정하고 어색한 표현을 더 자연스럽게 다듬어주세요.
결과는 오직 순수 JSON으로만 반환해야 합니다. 응답 형식: {"explanation": "무엇이 틀렸고 어떻게 고쳤는지 브리핑 (2-3문장)", "correctedText": "최종 완성된 전체 텍스트 본문 (해당 텍스트 속성은 마크다운이 없어야 함)"}
텍스트: ${text}`

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
      })
    }
  )
  const data = await resp.json()
  const text_result = data.candidates[0].content.parts[0].text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

  return new Response(text_result, { headers: { 'Content-Type': 'application/json' } })
})
