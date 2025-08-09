module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

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
      console.error('Invalid JSON:', err);
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }

  const name = (body.name || '').trim();
  const email = (body.email || '').trim();
  const honeypot = (body.hp || '').trim();

  if (honeypot) {
    console.log('Honeypot triggered — spam blocked');
    return res.status(200).json({ ok: true });
  }

  if (!name || !email) {
    console.error('Missing name or email');
    return res.status(400).json({ error: 'Missing name or email' });
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  console.log('BOT_TOKEN:', BOT_TOKEN ? 'Set' : 'Missing');
  console.log('CHAT_ID:', CHAT_ID);

  const text = `<b>New lead</b>\n<b>Name:</b> ${name}\n<b>Email:</b> ${email}`;

  const tgUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    const tgRes = await fetch(tgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' })
    });

    const tgJson = await tgRes.json();
    console.log('Telegram API response:', tgJson);

    if (!tgJson.ok) {
      return res.status(502).json({ error: 'Telegram API error', detail: tgJson });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Fetch to Telegram failed:', err);
    return res.status(500).json({ error: 'Request failed', detail: err.message });
  }
};
