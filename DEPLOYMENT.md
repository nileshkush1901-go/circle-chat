# Deploy on Render Free with MongoDB Atlas Free

1. Create a MongoDB Atlas Free cluster and a database user with read/write
   access to the `circle` database. Copy the Drivers connection string, replace
   its password (URL-encode special characters), and set the database to `circle`.
2. In Render, choose **New > Blueprint**, connect GitHub, and grant access to
   the private `nileshkush1901-go/circle-chat` repository. Select `main`.
3. The repository's `render.yaml` defines one Free Node service that builds
   Angular and serves the frontend, API, and Socket.IO from one HTTPS address.
   Enter the Atlas URI as the secret `MONGODB_URI`. Keep it out of GitHub/chat.
4. Add the Render service's outbound IP ranges (in its dashboard) to Atlas
   Network Access. If the first deployment failed before this, deploy again.
5. Open the Render service URL. `/api/health` should return `{"ok":true}`.
   Test login and room messages in two separate browser profiles.

`APP_ORIGIN` automatically uses the assigned Render URL. If you later use a
custom domain, set APP_ORIGIN to its exact HTTPS origin without a trailing slash.

## Free plan limitations

Render sleeps after 15 minutes without traffic; the first visit can be slow.
Render Free has no persistent disk: uploaded media is lost on restart or deploy.
Accounts and messages persist in Atlas. Use external media storage before relying
on uploads. Atlas Free has a 512 MB storage limit.

HTTP rate limits currently use the proxy peer IP and can be shared across users.
Before a wider public launch, configure trusted proxy handling for the deployed
request chain and verify that client addresses cannot be spoofed.

References:
- https://render.com/docs/free
- https://render.com/docs/blueprint-spec
- https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/
