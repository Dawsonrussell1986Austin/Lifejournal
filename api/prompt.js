// Generates short journaling + prayer prompts for the morning flow.
//   POST /api/prompt  { thankful, scripture } -> { journal, prayer }
const MODEL = 'claude-sonnet-5';

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(503).json({ error: 'not configured' }); return; }
  const thankful = String((req.body && req.body.thankful) || '').slice(0, 200);
  const scripture = String((req.body && req.body.scripture) || '').slice(0, 60);

  const prompt = [
    'You write for a Christian journaling app. Create two short prompts for this morning:',
    thankful ? `Today the writer is thankful for: "${thankful}".` : '',
    scripture ? `They are about to read ${scripture}.` : '',
    '',
    'Respond with ONLY a JSON object, no other text:',
    '{"journal": "<one warm, specific journaling question, max 20 words>",',
    ' "prayer": "<one short prayer starter the writer can continue, max 18 words>"}'
  ].filter(Boolean).join('\n');

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 200, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await r.json();
    if (!r.ok) { res.status(502).json({ error: 'generator error' }); return; }
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : {};
    res.status(200).json({
      journal: String(parsed.journal || '').slice(0, 240),
      prayer: String(parsed.prayer || '').slice(0, 240)
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
