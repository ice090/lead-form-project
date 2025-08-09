// api/sendLead.js
// Vercel Serverless Function (Node). No dependencies required.
// Make sure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set in Vercel env.

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // parse JSON body (works on Vercel). Fallback if body isn't parsed.
  let body = req.body;
  if (!body) {
    try {
      const raw = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (chunk) => (data += chunk));
        req.on('end', () => resolve(data));
        req.on('error', (err) => reject(err));
      });
      body = raw ? JSON.parse(raw) : {};
    } catch (err) {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }

  const name = (body.name || '').toString().trim();
  const email = (body.email || '').toString().trim();
  const honeypot = (body.hp || '').toString().trim();

  // simple honeypot spam block
  if (honeypot) {
    return res.status(200).json({ ok: true }); // silently accept spam
  }

  if (!name || !email) {
    return res.status(400).json({ error: 'Missing name or email' });
  }

  // basic email validation
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    return res.status(500).json({ error: 'Server not configured (missing env vars)' });
  }

  // small helper to escape HTML for Telegram's HTML parse_mode
  const esc = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const text = `<b>New lead</b>\n<b>Name:</b> ${esc(name)}\n<b>Email:</b> ${esc(email)}\n<b>Time:</b> ${new Date().toISOString()}`;

  const tgUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    const tgRes = await fetch(tgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' })
    });

    const tgJson = await tgRes.json();
    if (!tgRes.ok || !tgJson.ok) {
      // surface Telegram error
      return res.status(502).json({ error: 'Telegram API error', detail: tgJson });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Request failed', detail: err.message });
  }
};
