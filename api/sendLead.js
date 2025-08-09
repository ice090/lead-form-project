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

  // --- Improved IP detection for Vercel/CDN ---
  const getClientIp = () => {
    let ip = req.headers['x-real-ip'];
    if (!ip && req.headers['x-forwarded-for']) {
      ip = req.headers['x-forwarded-for'].split(',')[0].trim();
    }
    if (!ip) {
      ip = req.connection?.remoteAddress || req.socket?.remoteAddress || 'Unknown';
    }
    // Remove IPv6 prefix if present
    if (ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');
    return ip;
  };
  const ip = getClientIp();

  const userAgent = req.headers['user-agent'] || 'Unknown';
  const isMobile = /mobile/i.test(userAgent);
  const deviceType = isMobile ? 'Mobile' : 'Desktop';

  // --- Location lookup with timeout ---
  const fetchLocation = async () => {
    try {
      const res = await fetch(`https://ipapi.co/${ip}/json/`);
      if (res.ok) {
        const json = await res.json();
        if (json.city && json.country_name) {
          return `${json.city}, ${json.region}, ${json.country_name}`;
        }
      }
    } catch (err) {
      console.error('Location lookup failed:', err);
    }
    return 'Unknown';
  };

  const location = await Promise.race([
    fetchLocation(),
    new Promise((resolve) => setTimeout(() => resolve('Unknown'), 1500)) // 1.5s timeout
  ]);

  // Escape HTML for Telegram
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
