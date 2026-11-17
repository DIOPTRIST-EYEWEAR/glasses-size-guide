export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing image data' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GROQ_API_KEY is not set in Vercel' });
    }

    const prompt = `Locate the rectangular physical card (credit card, bank card, or ID card) held against the person's forehead. Return ONLY valid JSON with normalized bounding box coordinates from 0 to 1000: {"ymin": number, "xmin": number, "ymax": number, "xmax": number}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.8-27b',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageBase64 } }
          ]
        }],
        response_format: { type: 'json_object' },
        temperature: 0.1
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Groq API rejected the request' });
    }

    const textResult = data.choices?.[0]?.message?.content;
    if (!textResult) {
      return res.status(500).json({ error: 'Empty response from Groq' });
    }

    const box = JSON.parse(textResult);
    return res.status(200).json({ box });

  } catch (error) {
    console.error('Card detection error:', error);
    return res.status(500).json({ error: error.message || 'AI card detection failed' });
  }
}
