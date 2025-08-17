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
  const contact = (body.contact || '').trim(); // Can be email or phone
  const honeypot = (body.hp || '').trim();

  if (honeypot) {
    return res.status(200).json({ ok: true }); // spam blocked
  }

  if (!name || !contact) {
    return res.status(400).json({ error: 'Missing name or contact' });
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

  // --- Location & ISP lookup with fallback ---
  let location = 'Unknown';
  let isp = 'Unknown';

  const getFromIpApiCo = async () => {
    const res = await fetch(`https://ipapi.co/${ip}/json/`);
    if (res.ok) {
      const json = await res.json();
      if (json.city && json.country_name) {
        location = `${json.city}, ${json.region}, ${json.country_name}`;
      }
      if (json.org) {
        isp = json.org;
      }
    }
  };

  const getFromIpWhoIs = async () => {
    const res = await fetch(`https://ipwho.is/${ip}`);
    if (res.ok) {
      const json = await res.json();
      if (json.city && json.country) {
        location = `${json.city}, ${json.region}, ${json.country}`;
      }
      if (json.connection && json.connection.org) {
        isp = json.connection.org;
      }
    }
  };

  if (ip && ip !== '127.0.0.1' && ip !== 'Unknown') {
    try {
      await Promise.race([
        getFromIpApiCo(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500))
      ]);

      if (location === 'Unknown') {
        await Promise.race([
          getFromIpWhoIs(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500))
        ]);
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
    `<b>Contact:</b> ${esc(contact)}\n` + // flexible field
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
