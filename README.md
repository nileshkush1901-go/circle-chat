# Circle Chat

An independent Y99-inspired community chat app using **Angular 20, Node.js 24, Express 5, MongoDB and Socket.IO**. Source, Docker setup, integration tests and a prebuilt Angular bundle are included.

This implements the main community-chat workflows. It is **not a pixel-identical copy or complete feature-for-feature reproduction of Y99** and has no connection to Y99's servers, users, messages, branding or proprietary source code.

## Start with Docker (Windows, macOS or Linux)

Install Docker Desktop with Compose, extract this folder, open a terminal inside it, then run:

```sh
docker compose up --build
```

Open **http://localhost:3000**. Open an incognito window or a different browser for a second independent user. Choose a nickname in each and join the same room. Ordinary tabs in the same browser share the login cookie.

The database and uploads use persistent Docker volumes. `docker compose down` stops the app without deleting its data. The supplied Compose configuration is for your own computer: only the app's port is exposed, bound to localhost, and MongoDB is not published to the host.

## Run as a MEAN development project

Requirements: Node.js 24, npm, and a running MongoDB 7+ instance.

```sh
npm ci
```

Copy `.env.example` to `.env` (PowerShell: `Copy-Item .env.example .env`) and set your `MONGODB_URI` if necessary. Then:

```sh
npm run dev
```

Open **http://localhost:4200**. Angular proxies `/api` and `/socket.io` to Express on port 3000.

For a local optimized build, change `APP_ORIGIN` to `http://localhost:3000` in `.env`, then:

```sh
npm run build
npm start
```

Express serves both the API and the built Angular app. The included `client/dist/browser` was compiled successfully, but you should rebuild after editing the frontend.

## Implemented workflows

| Area            | Behavior                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Accounts        | Guest nicknames, registration, username/password login, profile editing, sign-out and seven-day sessions                     |
| Public rooms    | Search, category filtering, six empty starter rooms, room creation, live presence, room history and older-message pagination |
| Private rooms   | Owner-generated invitation codes, server-side membership checks and owner-controlled member removal                          |
| Messages        | Real-time delivery, typing indicators, persisted history, own-message removal and moderator removal                          |
| Direct messages | Private two-person conversations and inbox navigation; participants checked on reads, sends and call signals                 |
| Random chat     | Matches two real people who are waiting; does not simulate users or send bot messages                                        |
| Media           | Authenticated image, video and audio uploads up to 10 MB; magic-byte validation; access checked against the source room      |
| Voice/video     | Consent-based one-to-one calls, WebRTC signaling, camera toggle, microphone mute, decline and hang-up                        |
| Whiteboard      | Shared strokes and room history persisted in MongoDB; room owner/admin can clear                                             |
| Watch together  | Play/pause and position synchronization of MP4/WebM uploads in the current room                                              |
| Moderation      | User blocking, message reports, admin report queue, account bans and session revocation                                      |
| Interface       | Responsive room directory, room chat, direct messages, profile dialogs and mobile navigation                                 |

All starter room counts come from actual connected sockets. There are no seeded human profiles, fabricated messages or fake online counts.

## Create an administrator

Register a normal account in the UI first, then run:

```sh
npm run admin -w server -- your_username
```

With Docker:

```sh
docker compose exec app node server/src/admin.js your_username
```

Sign out and back in to refresh the UI role. The moderation queue appears in the sidebar. Admin access is granted only through this server-side command; registration never accepts a role.

## Tests and verification status

```sh
# No database required:
node --test server/test/security.test.js

# Full suite: uses a disposable real MongoDB via mongodb-memory-server:
npm test
```

The test runner uses an isolated database. If a local MongoDB binary cannot be started, supply a dedicated test server URI:

```sh
# Linux/macOS
MONGODB_TEST_URI=mongodb://127.0.0.1:27017 npm test
```

PowerShell:

```powershell
$env:MONGODB_TEST_URI="mongodb://127.0.0.1:27017"
npm test
```

The integration suite exercises real sockets and database operations: two-user delivery, persisted history, registration, private-room isolation, upload access, removal/ban rules, blocking, random matching, whiteboard persistence and admin-only reports. It creates a uniquely named database and drops only that test database afterward.

**Latest local verification:** production compilation, all 14 server tests, and
two browser workflow tests passed after the component refactor. See
[VERIFICATION.md](VERIFICATION.md) for scope and remaining checks.

## Deployment

Use a host that supports a long-running Node.js process and WebSockets, plus MongoDB. Serve Angular and Express on the same origin. Configure:

- `MONGODB_URI`: authenticated database URI accessible only to the app.
- `APP_ORIGIN`: exact HTTPS origin, with no trailing slash.
- `NODE_ENV=production`: enables Secure, HttpOnly, SameSite cookies.
- `UPLOAD_DIR`: persistent writable storage. Local ephemeral container files will not survive a replacement.
- `ICE_SERVERS`: WebRTC ICE server JSON. Reliable calls across restrictive networks require a TURN relay. The default public STUN server alone is not sufficient for all networks. Any TURN credentials returned by `/api/rtc-config` are visible to authenticated clients; use scoped short-lived credentials, not provider API secrets.

Terminate TLS at your reverse proxy and forward WebSocket upgrades. The default rate limit sees the direct peer IP: behind a proxy, configure Express `trust proxy` precisely for your own proxy before exposing the app publicly, otherwise limits may be shared by all visitors. Do not indiscriminately trust arbitrary forwarded headers.

This release is designed for **one Node.js instance**. Presence, random matching, rate-limit counters and live call coordination are process-local. Add a shared Socket.IO adapter and shared coordination/rate-limit storage before scaling horizontally. Messages, users, sessions, room memberships, reports and room activities are persisted in MongoDB.

## Boundaries and remaining work

- No live hosted URL is provided; you need to run or deploy the project.
- Voice/video is one-to-one, not group conferencing or screen sharing.
- Watch-together supports uploaded videos, not YouTube/Vimeo players.
- No mini-game catalogue, email verification, email password recovery, friend requests, push notifications, ad integration or multilingual UI is implemented.
- There is no claim of end-to-end encryption; the server can read stored chat content.
- Guests are temporary identities, not verified people. Logging out of a guest account loses access to it; accounts use username/password for return visits.
- Uploads are validated by format, not malware/content-scanned. Report handling is manual. Operational moderation, abuse monitoring, data retention/deletion policy, backups, storage quotas, automated media screening and load testing are needed before a public anonymous-chat launch.
- Whiteboard history is bounded to the latest 500 strokes. The room directory and member lists are bounded to 200 records; the inbox lists the latest 100 conversations. Add pagination for larger communities.
- No production traffic, load or external-network call tests have been performed.

## Architecture and development

The frontend uses standalone feature components and injectable services. The
backend uses feature routers, shared middleware, individual database models and
separate realtime event modules.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the directory map, dependency rules,
adding features, reusing this structure, and test commands.
See [DEPLOYMENT.md](DEPLOYMENT.md) for Render and Atlas configuration.

Reference reviewed: https://y99.in/ and its public guest-entry screen, 29 September 2026. This app uses original branding and UI text.
