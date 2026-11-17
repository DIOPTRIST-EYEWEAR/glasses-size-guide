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

    const prompt = `Detect ONLY the rectangular plastic card (credit card, loyalty card, or ID card) held on the person's forehead. Do NOT include the person's fingers, hand, or hair in the box—tightly bound only the four straight edges of the plastic card itself.
Return ONLY valid JSON with normalized integer coordinates from 0 to 1000:
{"ymin": 100, "xmin": 200, "ymax": 300, "xmax": 400}`;

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
        temperature: 0.0
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

    const parsed = JSON.parse(textResult);
    let ymin, xmin, ymax, xmax;
    const target = parsed.box || parsed.bounding_box || parsed.coordinates || parsed;

    if (Array.isArray(target) && target.length >= 4) {
      [ymin, xmin, ymax, xmax] = target.map(Number);
    } else if (Array.isArray(target.bbox_2d) && target.bbox_2d.length >= 4) {
      [xmin, ymin, xmax, ymax] = target.bbox_2d.map(Number);
    } else {
      ymin = Number(target.ymin ?? target.y_min ?? target.top);
      xmin = Number(target.xmin ?? target.x_min ?? target.left);
      ymax = Number(target.ymax ?? target.y_max ?? target.bottom);
      xmax = Number(target.xmax ?? target.x_max ?? target.right);
    }

    if ([ymin, xmin, ymax, xmax].some(v => Number.isNaN(v)) || xmax <= xmin || ymax <= ymin) {
      return res.status(422).json({ error: `Unexpected coordinate format from AI: ${textResult}` });
    }

    return res.status(200).json({ box: { ymin, xmin, ymax, xmax } });

  } catch (error) {
    console.error('Card detection error:', error);
    return res.status(500).json({ error: error.message || 'AI card detection failed' });
  }
}
