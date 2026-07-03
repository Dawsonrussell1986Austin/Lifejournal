// Generates a one-page Bible study for a passage via the Anthropic API.
//
//   POST /api/study   { "reference": "John 3:16" }  ->  { "study": "…markdown…" }
//
// Requires the ANTHROPIC_API_KEY environment variable (Vercel project setting).
// The study focuses on cultural/historical context, application, and how the
// passage points to the Gospel.

const MODEL = 'claude-sonnet-5';

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(503).json({ error: 'Bible study generation isn’t configured yet — the ANTHROPIC_API_KEY environment variable needs to be set in Vercel.' });
    return;
  }
  const reference = String((req.body && req.body.reference) || '').trim().slice(0, 60);
  // A conservative shape check so the model only ever sees a scripture ref.
  if (!/^[1-3]?\s?[A-Za-z][A-Za-z .]{1,30}(\s\d{1,3})(:\d{1,3}(-\d{1,3})?)?$/.test(reference)) {
    res.status(400).json({ error: 'That doesn’t look like a passage reference.' });
    return;
  }

  const prompt = [
    `Write a one-page personal Bible study on ${reference} for a Christian journaling app called Life Journal.`,
    '',
    'Structure it with exactly these markdown sections:',
    '### The Passage — one short paragraph orienting the reader to what happens in this passage and where it sits in the book.',
    '### Cultural & Historical Context — the richest section. What would the original audience have understood? Customs, geography, language nuances, historical setting.',
    '### How It Points to the Gospel — connect this passage to Christ and the redemption story, whether Old or New Testament.',
    '### Living It Out — concrete, practical application for an ordinary believer today (family, work, faith habits).',
    '### Reflect — exactly 3 short journaling questions.',
    '### Pray — a 2–3 sentence closing prayer drawn from the passage.',
    '',
    'Tone: warm, biblically faithful, plain-spoken — no academic jargon. 450–650 words total.',
    'Do not include any preamble before the first section header.'
  ].join('\n');

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1600,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await r.json();
    if (!r.ok) {
      res.status(502).json({ error: (data && data.error && data.error.message) || 'The study generator had a problem.' });
      return;
    }
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (!text) {
      res.status(502).json({ error: 'Empty response from the study generator.' });
      return;
    }
    res.status(200).json({ study: text, reference });
  } catch (e) {
    res.status(502).json({ error: 'Could not reach the study generator: ' + e.message });
  }
};
