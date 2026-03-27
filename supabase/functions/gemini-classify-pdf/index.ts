import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  })
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const { pdfBase64 } = await req.json()

  const prompt = `이 문서(PDF)의 내용을 분석해서, 다음 중 어떤 종류의 문서인지 정확히 1개만 알려주세요: [이력서, 자기소개서, 포트폴리오, 기타서류].
1. 이력서: 개인사진, 학력, 경력사항, 기본인적사항 있음
2. 자기소개서: 1, 2, 3번 문항 등 에세이 형식의 긴 글위주
3. 포트폴리오: 프로젝트 명세, 역할, 디자인, 시각화 산출물 등
반드시 순수 JSON 형식으로 응답: {"type": "문서종류"}`

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    }
  )
  const data = await resp.json()
  const text_result = data.candidates[0].content.parts[0].text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

  return new Response(text_result, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
