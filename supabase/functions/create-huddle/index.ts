import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { name, invite_token, word, letter_meanings, user_id } = await req.json()

    // Create a Supabase client with the service role key — bypasses RLS entirely
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Insert huddle
    const { data: huddle, error: huddleError } = await supabase
      .from('huddles')
      .insert({ name, founder_id: user_id, invite_token })
      .select()
      .single()

    if (huddleError) throw huddleError

    // Insert word
    const { error: wordError } = await supabase
      .from('huddle_words')
      .insert({
        huddle_id: huddle.id,
        word: word.toUpperCase(),
        letter_meanings,
        is_active: true,
      })

    if (wordError) throw wordError

    // Insert member
    const { error: memberError } = await supabase
      .from('huddle_members')
      .insert({ huddle_id: huddle.id, user_id })

    if (memberError) throw memberError

    return new Response(
      JSON.stringify({ huddle_id: huddle.id, invite_token }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})