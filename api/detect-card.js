export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing image data' });
    }

    // Strip the data:image/jpeg;base64, prefix
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const prompt = `
      Locate the rectangular physical card (credit card, bank card, or ID card) being held against the person's forehead.
      Return ONLY a JSON object with the exact bounding box coordinates normalized from 0 to 1000:
      {"ymin": number, "xmin": number, "ymax": number, "xmax": number}
    `;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: 'image/jpeg', data: base64Data } }
          ]
        }],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.1
        }
      })
    });

    const data = await response.json();
    const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResult) {
      throw new Error('Failed to extract card coordinates from AI response.');
    }

    const box = JSON.parse(textResult);
    return res.status(200).json({ box });

  } catch (error) {
    console.error('Card detection error:', error);
    return res.status(500).json({ error: 'AI card detection failed' });
  }
}
