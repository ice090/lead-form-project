# Lead Collection Form → Telegram (Vercel Hosted)

A lightweight HTML form to collect leads and send them directly to a Telegram bot using Vercel Serverless Functions.

## Features

- Collects name, email, and message
- Sends data to your Telegram bot via the Bot API
- Hosted on Vercel, deployed from GitHub
- No backend server required

## Tech Stack

- HTML, CSS, JavaScript
- Node.js (Vercel Function)
- Telegram Bot API
- Vercel (Hosting)
- GitHub (Version control)

## Setup

1. **Create a Telegram Bot** using [@BotFather](https://t.me/BotFather) and note the token.
2. **Get your Chat ID** (use [@userinfobot](https://t.me/userinfobot) or a bot API call).
3. Add these as environment variables in Vercel:

   - `BOT_TOKEN`
   - `CHAT_ID`

4. Push the project to GitHub and connect it to Vercel.
5. Deploy!

## License

MIT
