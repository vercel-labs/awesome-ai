# Better Auth + Convex setup

## 1) Convex deployment env

Set required Better Auth env vars in Convex:

```bash
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
npx convex env set SITE_URL "http://localhost:3000"
npx convex env set VERCEL_CLIENT_ID "<your-vercel-client-id>"
npx convex env set VERCEL_CLIENT_SECRET "<your-vercel-client-secret>"
```

Generate and persist static JWKS:

```bash
npx convex run auth:getLatestJwks | npx convex env set JWKS
```

## 2) Next.js local env

Add these to `.env.local`:

```bash
NEXT_PUBLIC_CONVEX_URL=<your-convex-cloud-url>
NEXT_PUBLIC_CONVEX_SITE_URL=<your-convex-site-url>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 3) Apply schema/functions

Push schema and function updates:

```bash
npx convex dev --once
```
