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

  const { text, sourceUrl, images } = await req.json()

  const prompt = `다음 채용 공고 정보(입력 텍스트 및 첨부된 캡처본)에서 기업명, 직무명, 마감일, 자소서 문항을 추출해 순수 JSON만 반환하세요.
원본 출처 URL은 사용자가 별도로 입력했으므로 해당 URL을 그대로 유지하세요.
반환할 JSON 형식:
{ "company": "기업명", "role": "직무명", "deadline": "YYYY-MM-DD(상시모집이면 '상시모집')", "questions": ["문항1", "문항2"], "sourceUrl": "${sourceUrl}" }
입력된 텍스트/URL 정보: ${text || '빈 텍스트(첨부된 이미지 참조)'}`

  const parts: any[] = [{ text: prompt }]
  if (images) {
    images.forEach((img: { base64Data: string; mimeType: string }) => {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64Data } })
    })
  }

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json' } })
    }
  )
  const data = await resp.json()
  const text_result = data.candidates[0].content.parts[0].text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

  return new Response(text_result, { headers: { 'Content-Type': 'application/json' } })
})
