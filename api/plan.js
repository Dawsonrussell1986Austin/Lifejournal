// Turns a one-line Five Foundations goal into a full 12-week blueprint plan.
//   POST /api/plan
//     { foundation, goal, weeks, scripture }
//   -> { what, how, who, where, when, why, weeks: ["wk1 action", ... x12] }
const MODEL = 'claude-sonnet-5';

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(503).json({ error: 'not configured' }); return; }

  const b = req.body || {};
  const foundation = String(b.foundation || 'Focus').slice(0, 20);
  const goal = String(b.goal || '').slice(0, 240);
  const weeks = Math.min(13, Math.max(1, parseInt(b.weeks, 10) || 12));
  const scripture = String(b.scripture || '').slice(0, 120);
  if (!goal.trim()) { res.status(400).json({ error: 'goal required' }); return; }

  const prompt = [
    `You are a wise, encouraging Christian discipleship coach helping someone plan a ${weeks}-week goal`,
    `in their "${foundation}" foundation (part of the Five Foundations: Faith, Family, Finances, Fitness, Focus).`,
    scripture ? `The foundation's anchor scripture is ${scripture}.` : '',
    `Their goal, in their words: "${goal}".`,
    '',
    'Build them a realistic, Gospel-focused blueprint. Keep every field concrete and specific to THEIR goal',
    '(use real numbers/cadence when the goal implies them), warm but practical, and never generic.',
    '',
    'Respond with ONLY a JSON object, no other text or markdown:',
    '{',
    '  "what": "<the goal restated as one clear, measurable sentence, max 22 words>",',
    '  "how": "<the daily / weekly / monthly rhythm to reach it, max 30 words>",',
    '  "who": "<who could help or hold them accountable, max 18 words>",',
    '  "where": "<where they will do the work, max 14 words>",',
    '  "when": "<when in their day/week they will work on it, max 16 words>",',
    '  "why": "<why it matters for them and for God\'s Kingdom, max 24 words>",',
    `  "weeks": [<exactly ${weeks} strings, one concrete focus/commitment per week that builds toward the goal, each max 14 words>]`,
    '}'
  ].filter(Boolean).join('\n');

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 900, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await r.json();
    if (!r.ok) { res.status(502).json({ error: 'generator error' }); return; }
    const text = (data.content || []).filter((x) => x.type === 'text').map((x) => x.text).join('');
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : {};
    const s = (v, n) => String(v || '').slice(0, n);
    let wk = Array.isArray(parsed.weeks) ? parsed.weeks.map((x) => s(x, 120)) : [];
    wk = wk.slice(0, weeks);
    while (wk.length < weeks) wk.push('');
    res.status(200).json({
      what: s(parsed.what, 200), how: s(parsed.how, 240), who: s(parsed.who, 160),
      where: s(parsed.where, 140), when: s(parsed.when, 140), why: s(parsed.why, 200),
      weeks: wk
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
