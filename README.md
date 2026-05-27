# pomoblock-backend
ExpressJS backend on Vercel for iOS in-app update enforcement. Verifies App Store Connect webhooks to detect new releases, persists version state to a database, and serves a /api/config endpoint so mobile clients can determine whether a force or flexible update is required.

## test

```bash
npx tsc --noEmit
npm run dev
```