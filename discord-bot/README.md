# FreightMP Discord Bot

Discord bot for **FreightMP (FMP)**, the multiplayer platform/hub for Euro Truck Simulator 2
and American Truck Simulator, operated by **FR | Industries Corporation (FIC)**.

## Prerequisites

- Node.js 20+
- A Discord application with a Bot user

## Setup

1. Create an application at <https://discord.com/developers/applications> and add a Bot user.
2. Copy the bot token and the application **Client ID**.
3. In **Bot** settings, enable the privileged intent **SERVER MEMBERS INTENT**
   (required for the role-sync loop to fetch the full member list).
4. Invite the bot to your guild with the `bot` and `applications.commands` scopes.
   It needs the **Manage Roles** permission for role synchronization.
5. Create a `.env` file from `.env.example` and fill in every value, including the Discord
   role IDs for each FreightMP platform role (`ADMIN`, `DEV`, `MODERATOR`, `DRIVER`).
   Leave a role ID empty to skip mapping that platform role.

## Commands

| Command    | Description                                    |
| ---------- | ---------------------------------------------- |
| `/status`  | Afficher l'état du réseau multijoueur FreightMP |

## Scripts

| Script              | Description                                              |
| ------------------- | -------------------------------------------------------- |
| `npm run dev`       | Run with `tsx watch` (development)                       |
| `npm run build`     | Compile TypeScript to `dist/`                            |
| `npm run start`     | Run the compiled bot from `dist/`                        |
| `npm run register`  | Register slash commands (guild-scoped if `DISCORD_GUILD_ID` is set, otherwise global) |

## Run

```bash
npm install
npm run register
npm run dev
```

## Docker

```bash
docker build -t freightmp-discord-bot .
docker run --env-file .env freightmp-discord-bot
```

> `npm ci` requires a `package-lock.json`; run `npm install` once to generate it before
> building the Docker image.
