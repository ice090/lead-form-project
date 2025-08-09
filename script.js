const form = document.getElementById('leadForm');
const statusEl = document.getElementById('status');
const btn = document.getElementById('submitBtn');

function show(msg, ok = true) {
  statusEl.textContent = msg;
  statusEl.style.color = ok ? '' : '#b91c1c';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  show('', true);

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const hp = document.getElementById('hp').value.trim(); // honeypot

  if (!name || !email) {
    show('Please provide both name and email.', false);
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    const res = await fetch('/api/sendLead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, hp })
    });

    const json = await res.json();
    if (res.ok && json.ok) {
      show('Thanks — we received your info! You’ll get a message soon.');
      form.reset();
    } else {
      show(json.error || 'Something went wrong. Try again later.', false);
    }
  } catch (err) {
    show('Network error — please try again.', false);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Get started';
  }
});
