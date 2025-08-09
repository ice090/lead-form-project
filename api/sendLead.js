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
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }

  const name = (body.name || '').trim();
  const email = (body.email || '').trim();
  const honeypot = (body.hp || '').trim();

  if (honeypot) {
    return res.status(200).json({ ok: true }); // spam blocked
  }

  if (!name || !email) {
    return res.status(400).json({ error: 'Missing name or email' });
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  // --- Improved IP detection ---
  const getClientIp = () => {
    let ip = req.headers['x-real-ip'];
    if (!ip && req.headers['x-forwarded-for']) {
      ip = req.headers['x-forwarded-for'].split(',')[0].trim();
    }
    if (!ip) {
      ip = req.connection?.remoteAddress || req.socket?.remoteAddress || 'Unknown';
    }
    if (ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');
    return ip || 'Unknown';
  };
  const ip = getClientIp();

  const userAgent = req.headers['user-agent'] || 'Unknown';
  const deviceType = /mobile/i.test(userAgent) ? 'Mobile' : 'Desktop';

  // --- Location & ISP lookup ---
  let location = 'Unknown';
  let isp = 'Unknown';
  if (ip && ip !== '127.0.0.1' && ip !== 'Unknown') {
    try {
      const locRes = await Promise.race([
        fetch(`https://ipapi.co/${ip}/json/`),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1500))
      ]);

      if (locRes && locRes.ok) {
        const locJson = await locRes.json();
        if (locJson.city && locJson.country_name) {
          location = `${locJson.city}, ${locJson.region}, ${locJson.country_name}`;
        }
        if (locJson.org) {
          isp = locJson.org;
        }
      }
    } catch (err) {
      console.error('Location lookup failed:', err.message);
    }
  }

  // Escape HTML for Telegram
  const esc = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const text =
    `<b>New lead</b>\n` +
    `<b>Name:</b> ${esc(name)}\n` +
    `<b>Email:</b> ${esc(email)}\n` +
    `<b>IP:</b> ${esc(ip)}\n` +
    `<b>Location:</b> ${esc(location)}\n` +
    `<b>ISP/Org:</b> ${esc(isp)}\n` +
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
      return res.status(502).json({ error: 'Telegram API error', detail: tgJson });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Request failed', detail: err.message });
  }
};
