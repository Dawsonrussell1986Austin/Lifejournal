// Serverless sync endpoint backed by a private Vercel Blob store.
//
//   GET  /api/sync?code=XXXX  -> 200 with the stored payload, or 204 if none
//   POST /api/sync?code=XXXX  -> stores the JSON body for that code
//
// Data for a sync code lives at sync/<sha256(code)>.json, so the raw code is
// never used as a filename and the blob store is private (only this function,
// using BLOB_READ_WRITE_TOKEN, can read it).
const { put, get } = require('@vercel/blob');
const crypto = require('crypto');

function keyFor(code) {
  const hash = crypto.createHash('sha256').update('lifejournal:' + code).digest('hex');
  return 'sync/' + hash + '.json';
}

async function streamToString(stream) {
  return await new Response(stream).text();
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  const code = (req.query && req.query.code ? String(req.query.code) : '').trim();
  if (code.length < 6) {
    res.status(400).json({ error: 'Sync code must be at least 6 characters.' });
    return;
  }
  const pathname = keyFor(code);

  try {
    if (req.method === 'GET') {
      let result = null;
      try { result = await get(pathname, { access: 'private' }); } catch (e) { result = null; }
      if (!result || result.statusCode !== 200 || !result.stream) { res.status(204).end(); return; }
      const text = await streamToString(result.stream);
      res.setHeader('Content-Type', 'application/json');
      res.status(200).send(text);
      return;
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      // The body may arrive already parsed (object), as a string, or — when the
      // platform body parser is disabled — only on the raw stream. Never fall
      // back to storing '{}', which would silently clobber a good backup.
      const body = req.body;
      let raw = (body && typeof body === 'object') ? JSON.stringify(body)
              : (typeof body === 'string' ? body : '');
      if (!raw) raw = await streamToString(req);
      raw = (raw || '').trim();

      let parsed = null;
      try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
      if (!parsed || !parsed.library) {
        res.status(400).json({ error: 'Empty or invalid sync payload.' });
        return;
      }

      await put(pathname, JSON.stringify(parsed), {
        access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json'
      });
      res.status(200).json({ ok: true, savedAt: Date.now() });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
