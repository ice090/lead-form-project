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

  // Honeypot spam block
  if (honeypot) {
    console.log('Honeypot triggered — spam blocked');
    return res.status(200).json({ ok: true });
  }

  if (!name || !email) {
    return res.status(400).json({ error: 'Missing name or email' });
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  // Get IP & user agent
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0] : req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const isMobile = /mobile/i.test(userAgent);
  const deviceType = isMobile ? 'Mobile' : 'Desktop';

  // Get location from IP
  let location = 'Unknown';
  try {
    const locRes = await fetch(`https://ipapi.co/${ip}/json/`);
    if (locRes.ok) {
      const locJson = await locRes.json();
      if (locJson && locJson.city && locJson.country_name) {
        location = `${locJson.city}, ${locJson.region}, ${locJson.country_name}`;
      }
    }
  } catch (err) {
    console.error('Location lookup failed:', err);
  }

  // Escape for Telegram HTML
  const esc = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const text =
    `<b>New lead</b>\n` +
    `<b>Name:</b> ${esc(name)}\n` +
    `<b>Email:</b> ${esc(email)}\n` +
    `<b>IP:</b> ${esc(ip)}\n` +
    `<b>Location:</b> ${esc(location)}\n` +
    `<b>Device:</b> ${esc(deviceType)}\n` +
    `<b>User Agent:</b> ${esc(userAgent)}\n` +
    `<b>Time:</b> ${new Date().toISOString()}`;

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' })
    });

    const tgJson = await tgRes.json();
    if (!tgJson.ok) {
      console.error('Telegram API error:', tgJson);
      return res.status(502).json({ error: 'Telegram API error', detail: tgJson });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Telegram request failed:', err);
    return res.status(500).json({ error: 'Request failed', detail: err.message });
  }
};
