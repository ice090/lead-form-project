const form = document.getElementById('leadForm');
const statusEl = document.getElementById('status');
const btn = document.getElementById('submitBtn');

function show(msg, ok = true) {
  statusEl.textContent = msg;
  statusEl.style.color = ok ? '' : '#b91c1c';
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value) {
  // Accepts digits, spaces, dashes, parentheses, optional +country code
  return /^\+?[0-9\s\-()]{7,20}$/.test(value);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  show('', true);

  const name = document.getElementById('name').value.trim();
  const contact = document.getElementById('contact').value.trim();
  const hp = document.getElementById('hp').value.trim();

  if (!name || !contact) {
    show('Please provide both name and contact.', false);
    return;
  }

  if (!isValidEmail(contact) && !isValidPhone(contact)) {
    show('Please enter a valid email or phone number.', false);
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    const res = await fetch('/api/sendLead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, contact, hp })
    });

    const json = await res.json();
    if (res.ok && json.ok) {
      show('Thanks — we received your info!');
      form.reset();
    } else {
      show(json.error || 'Something went wrong.', false);
    }
  } catch (err) {
    show('Network error — please try again.', false);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Get Started';
  }
});
