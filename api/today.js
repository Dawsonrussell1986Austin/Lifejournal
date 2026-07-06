// Suggests one concrete action for TODAY for each of the Five Foundations,
// derived from the 12-week goal + this week's commitment.
//   POST /api/today
//     { items: [{ foundation, goal, week }], weekday, week }
//   -> { tasks: ["<faith today>", ... one per item] }
const MODEL = 'claude-sonnet-5';

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(503).json({ error: 'not configured' }); return; }

  const b = req.body || {};
  const items = Array.isArray(b.items) ? b.items.slice(0, 5) : [];
  const weekday = String(b.weekday || '').slice(0, 12);
  const week = Math.min(12, Math.max(1, parseInt(b.week, 10) || 1));
  if (!items.length || !items.some((it) => (it && (it.week || it.goal)))) {
    res.status(400).json({ error: 'no plan yet' }); return;
  }

  const lines = items.map((it, i) =>
    `${i + 1}. ${it.foundation}: 12-week goal "${String(it.goal || '').slice(0, 160) || '(not set)'}"; this week "${String(it.week || '').slice(0, 160) || '(not set)'}"`);

  const prompt = [
    'You are a warm, practical Christian discipleship coach. For each of the Five Foundations below,',
    `suggest ONE small, concrete thing the person can actually do TODAY (${weekday || 'today'}, week ${week} of 12)`,
    "that moves this week's commitment forward. Make it specific and doable in a single day — not the whole",
    'weekly goal restated. If a foundation has no goal set, give a gentle starter action for it.',
    '',
    lines.join('\n'),
    '',
    'Respond with ONLY a JSON object, no other text:',
    `{"tasks": [<exactly ${items.length} strings, one per foundation in order, each max 14 words, phrased as an action>]}`
  ].join('\n');

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await r.json();
    if (!r.ok) { res.status(502).json({ error: 'generator error' }); return; }
    const text = (data.content || []).filter((x) => x.type === 'text').map((x) => x.text).join('');
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : {};
    let tasks = Array.isArray(parsed.tasks) ? parsed.tasks.map((x) => String(x || '').slice(0, 120)) : [];
    tasks = tasks.slice(0, items.length);
    while (tasks.length < items.length) tasks.push('');
    res.status(200).json({ tasks });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
