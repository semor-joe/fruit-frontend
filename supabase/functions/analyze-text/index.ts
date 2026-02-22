
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text, image_id, land_block_id } = await req.json()

    // Here you would integrate with an AI service like OpenAI or Azure Computer Vision
    // For now, allow a mock response based on text input

    const fertilizers: any[] = []
    
    // Example basic heuristic parsing (replace with real AI call)
    if (text && text.toLowerCase().includes('urea')) {
        const match = text.match(/(\d+)\s*(kg|g|lbs)/i)
        fertilizers.push({
            name: 'Urea',
            amount: match ? match[1] : 10,
            unit: match ? match[2] : 'kg'
        })
    }

    const result = {
      content: text || "Analysis of image content",
      fertilizers: fertilizers,
      extracted_data: {
        method: "AI Analysis",
        confidence: 0.95
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
