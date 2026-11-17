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
    const prompt = `Locate the rectangular physical card (credit card, bank card, or ID card) held against the person's forehead. Return ONLY valid JSON with normalized bounding box coordinates from 0 to 1000: {"ymin": number, "xmin": number, "ymax": number, "xmax": number}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
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
    const textResult = data.choices?.[0]?.message?.content;

    if (!textResult) {
      throw new Error('Failed to extract card coordinates.');
    }

    const box = JSON.parse(textResult);
    return res.status(200).json({ box });

  } catch (error) {
    console.error('Card detection error:', error);
    return res.status(500).json({ error: 'AI card detection failed' });
  }
}
