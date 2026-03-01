import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { huddle_id, user_id } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Verify the user is the founder of this huddle
    const { data: huddle, error: huddleError } = await supabase
      .from('huddles')
      .select('founder_id')
      .eq('id', huddle_id)
      .single()

    if (huddleError || !huddle) {
      return new Response(
        JSON.stringify({ error: 'Huddle not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (huddle.founder_id !== user_id) {
      return new Response(
        JSON.stringify({ error: 'Only the founder can delete this huddle' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Delete in order: reactions → comments → posts → huddle_words → huddle_members → huddle
    const postIds = await supabase
      .from('posts')
      .select('id')
      .eq('huddle_id', huddle_id)

    if (postIds.data && postIds.data.length > 0) {
      const ids = postIds.data.map(p => p.id)
      await supabase.from('reactions').delete().in('post_id', ids)
      await supabase.from('comments').delete().in('post_id', ids)
    }

    await supabase.from('posts').delete().eq('huddle_id', huddle_id)
    await supabase.from('huddle_words').delete().eq('huddle_id', huddle_id)
    await supabase.from('huddle_members').delete().eq('huddle_id', huddle_id)
    await supabase.from('huddles').delete().eq('id', huddle_id)

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})