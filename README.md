# Discord Welcome Bot

A Discord bot that sends a welcome embed message when a new member joins the server.

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```
   - `DISCORD_TOKEN` — your bot token from the [Discord Developer Portal](https://discord.com/developers/applications)
   - `WELCOME_CHANNEL_ID` — the ID of the channel where welcome messages will be sent

3. Enable the **Server Members Intent** in the Developer Portal under your bot's settings.

4. Run the bot:
   ```bash
   python bot.py
   ```

## What it does

When a member joins, the bot posts an embed in the configured channel showing:
- A personalized welcome message with a mention
- Their member number
- Their avatar
- The date they joined
