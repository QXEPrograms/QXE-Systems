# Discord Bot

A Discord bot with welcome messages, a rules-gating system, and moderation tools.

## Features

- **Welcome** — sends an embed when a member joins and assigns them an initial role
- **Rules gate** — posts rules with an Accept button; clicking it grants the `Verified` role that unlocks all channels
- **Moderation** — kick, ban, unban, timeout, warn, clear messages, slowmode

## Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in your `.env`:

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Bot token from the Discord Developer Portal |
| `WELCOME_CHANNEL_ID` | Channel ID for welcome messages |
| `JOIN_ROLE_ID` | Role given on join — should only allow viewing `#rules` |
| `VERIFIED_ROLE_ID` | Role given after accepting rules — unlocks all channels |
| `MOD_LOG_CHANNEL_ID` | Channel where moderation actions are logged |

### 3. Enable intents

In the [Discord Developer Portal](https://discord.com/developers/applications), enable:
- **Server Members Intent**
- **Message Content Intent**

### 4. Set up channel permissions

- `#rules` — allow `@everyone` (or the join role) to view; deny the `Verified` role if you want them moved out
- All other channels — deny `@everyone`, allow `Verified` role only

### 5. Run

```bash
python bot.py
```

### 6. Post the rules

In your `#rules` channel, run:
```
!postrules
```
This posts the default rules embed with the Accept button. You can also supply custom text:
```
!postrules **1.** Be kind. **2.** No spam.
```

---

## Commands

### Moderation (all actions are logged to `MOD_LOG_CHANNEL_ID`)

| Command | Permission | Description |
|---|---|---|
| `!kick @user [reason]` | Kick Members | Kick a member |
| `!ban @user [reason]` | Ban Members | Ban a member |
| `!unban <user_id> [reason]` | Ban Members | Unban by user ID |
| `!timeout @user <duration> [reason]` | Moderate Members | Timeout (e.g. `10m`, `2h`, `1d`) |
| `!untimeout @user` | Moderate Members | Remove a timeout |
| `!warn @user [reason]` | Kick Members | Warn a member (stored in `warnings.json`) |
| `!warnings @user` | Kick Members | View a member's warnings |
| `!clearwarnings @user` | Administrator | Clear all warnings for a member |
| `!clear <amount>` | Manage Messages | Delete up to 100 messages |
| `!slowmode <seconds>` | Manage Channels | Set slowmode (0 to disable) |

### Rules

| Command | Permission | Description |
|---|---|---|
| `!postrules [text]` | Administrator | Post the rules embed with Accept button |
