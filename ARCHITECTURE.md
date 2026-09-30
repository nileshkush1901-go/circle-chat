# Architecture and reuse guide

## Project layout

```text
client/src/
  main.ts                       bootstrap only
  app/
    app.component.*             application shell and lifecycle
    app.config.ts               Angular providers
    core/
      http/                     generic typed HTTP client
      realtime/                 socket connection and acknowledgements
      state/                    application state and zoneless update bridge
    features/
      auth/                     guest/login/register view
      session/                  session initialization and logout
      events/                   inbound socket event coordination
      rooms/                    room and conversation workflows
      room-directory/           room discovery view
      inbox/                    direct conversation list
      chat/                     composition of chat views
      chat-header/              room actions
      message-list/             message history and attachments
      message-composer/         message input and uploads
      member-list/              room membership view
      messages/                 message operations
      profile/                  profile and blocking operations
      moderation/               reports and moderation operations
      admin/                    report queue view
      activities/               shared board and playback operations
      whiteboard/               drawing view
      watch-party/              synchronized playback view
      calls/                    WebRTC resources and signaling
      call-panel/               call controls
      dialogs/                  profile, room, invite and report dialogs
      sidebar/, topbar/          navigation and notices
    shared/
      models/                   typed application contracts
      directives/               conditional DOM reference registration
  styles/                       foundation, features, responsive overrides
server/src/
  index.js                      process startup/shutdown
  app.js                        HTTP application composition
  config/                       validated environment configuration
  middleware/                   security, authentication, error responses
  modules/<feature>/            HTTP feature routers
  realtime.js                   socket lifecycle/authentication/rate limits
  realtime/<feature>.events.js  socket event groups
  database/models/              individual Mongoose schemas
  database/schema-options.js    common serialization options
  shared/                       validation and response serializers
  auth.js, access.js            shared authentication and authorization rules
  models.js                     stable model exports
server/test/                    API, configuration and socket regression tests
tests/e2e/                      browser workflows with isolated MongoDB
.github/workflows/ci.yml        format, build, server and browser checks
```

## Dependency rules

- Components render state and delegate operations to feature services.
- Feature services own workflows. HTTP requests go through `ApiClient`; socket
  commands go through `RealtimeClient`. Both default to `unknown` response types.
- `ChatState` is application-specific state, not a universal store. Its revision
  signal notifies views about external socket/media callbacks through
  `observeState()`. Async operations invoked by templates use `state.run()` to
  report errors and schedule a refresh. Background callbacks must refresh state
  after completing changes. This keeps the existing mutable forms and list
  behavior explicit; avoid introducing hidden mutable state in components.
- WebRTC connections and streams belong to `CallsService`. DOM references are
  registered by `appView` and removed when a conditional component is destroyed.
- Express middleware order is intentional: security, public endpoints,
  authentication, protected feature routers, frontend, error handler.
- Routers enforce input validation and call shared authorization rules. Extract
  a domain service when business logic is reused by HTTP and realtime code;
  avoid wrapper layers that only forward a database call.
- Socket modules register through the authenticated/rate-limited `event` helper.
  Never bypass it for a new authenticated command.
- Models are imported through `models.js` to keep feature imports stable.
- API paths, cookie policy, socket events and CSS cascade remain compatible.
  Components use transparent hosts (`display: contents`) so existing flex/grid
  layout applies to their semantic elements. Keep feature style imports ordered.

## Add a feature

1. Define request/response types in `shared/models`.
2. Add a standalone view and an injectable service under `features`.
3. Put business operations in the service; use typed `request<Response>()` calls.
4. Add a feature router under `server/src/modules`, validate input with Zod,
   and register it after `requireAuth` in `app.js` unless it must be public.
5. Add socket events under `server/src/realtime` only when realtime behavior is
   needed. Reuse the shared access rules.
6. Add behavior tests for access control and a browser workflow for new UI flows.

## Reuse for another project

Copy the repository without `.git`, `node_modules`, build output, uploads, local
MongoDB data or secrets. Rename workspace/package names and product metadata.
Keep the bootstrap, transport clients, middleware patterns, config validation,
formatting, test harness and CI. Replace chat-specific state, views, models and
socket events with your domain. Review cookie policy, origin validation and rate
limits for the new deployment. This is a reusable application structure, not an
empty template with all chat behavior removed.

## Commands

- `npm ci` — install the locked dependencies (Node 24).
- `npm run dev` — frontend and backend with local MongoDB.
- `npm run format` / `npm run format:check` — consistent source formatting.
- `npm run build` — strict TypeScript and Angular template compilation.
- `npm test` — server tests using a disposable MongoDB database.
- `npx playwright install chromium` — install the browser once.
- `npm run test:e2e` — build and exercise the production frontend.
- `npm run check` — formatting, build and server regression suite.

For an already installed Chrome, set `PLAYWRIGHT_CHANNEL=chrome`. To reuse an
existing MongoDB executable, set `MONGOMS_SYSTEM_BINARY` to its absolute path.
Never point tests at production. The browser harness always uses its own local
MongoDB instance. CI runs both suites and keeps browser traces on failure.

## Deployment and remaining operational work

Render still builds and serves both apps using the existing `render.yaml`.
Configuration is validated before connecting to MongoDB. APP_ORIGIN can fall
back to Render's assigned HTTPS URL. No database migration is required.

Free Render uploads are still ephemeral; use durable object storage for reliable
media. Proxy trust, TURN hosting, backups, abuse controls, monitoring, and
horizontal socket scaling require deployment-specific work. Browser regression
coverage does not replace real-device voice/video and mobile layout testing.
