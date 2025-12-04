export function prompt(): string {
	return `
Analyze this Next.js project and create a comprehensive migration plan for converting from Pages Router to App Router.

# Migration Requirements

**Source:** Next.js Pages Router (pages/ directory)
**Target:** Next.js App Router (app/ directory)

The App Router introduces React Server Components, nested layouts, and new data fetching patterns. I need a phased migration plan that maintains functionality throughout the process.

# Todo Tracking

**Use the todo tools to track migration progress.** Create todos for each migration phase and update them as analysis progresses. This ensures:
- Clear visibility of what's been analyzed vs pending
- Structured tracking of files to be migrated
- Progress checkpoints for each phase
- A checklist that can be handed off to the migration agent

Structure your todos like:
- \`[Phase 1] Foundational Setup - Analyze _app.js, _document.js\`
- \`[Phase 2] Route Migration - pages/index.js → app/page.tsx\`
- \`[Phase 2] Route Migration - pages/blog/[slug].js → app/blog/[slug]/page.tsx\`
- \`[Phase 3] API Routes - pages/api/users.js → app/api/users/route.ts\`

Mark todos as in_progress when analyzing, completed when plan is finalized for that item.

# What to Analyze

1. **Pages Directory:** Identify all pages
2. **API Routes:** Catalog all routes in pages/api/
3. **Data Fetching:** Document usage of getStaticProps, getServerSideProps, getStaticPaths, getInitialProps
4. **Special Files:** Review _app.js, _document.js, _error.js, 404.js, 500.js
5. **Middleware:** Check for middleware.ts and its route matchers

# Quality Assurance Requirements

For each file/route analyzed, document:

1. **Data Dependencies:** What data does it fetch? From where? With what caching?
2. **Client-Side Interactivity:** What requires 'use client'? (state, effects, event handlers)
3. **Test Coverage:** Are there existing tests? What needs test updates?
4. **Breaking Change Risk:** What could break during the migration?

## Verification Checkpoints

Each phase should include verification steps:

- [ ] All files in phase cataloged
- [ ] Data fetching patterns identified and transformation planned
- [ ] Client/Server component boundaries determined
- [ ] TypeScript types preservation strategy defined
- [ ] Potential breaking changes documented
- [ ] Testing approach specified

## Dependency Compatibility

Check for these common compatibility issues:
- next-auth: Requires App Router-specific configuration
- styled-components/emotion: Need 'use client' wrapper setup
- react-query/swr: May need client component boundaries
- i18n libraries or Next.js built-in i18n: Different setup for App Router
- Custom webpack configurations in next.config.js

# Component Boundary Analysis

Create a **Server/Client Component Tree** for each route. This is critical for App Router success:

\`\`\`
Route: /dashboard
├── layout.tsx (Server) - fetches user session
│   ├── Sidebar.tsx (Client) - has useState for collapse
│   │   └── NavLinks.tsx (Server) - static navigation
│   └── {children}
│       └── page.tsx (Server) - fetches dashboard data
│           ├── StatsGrid.tsx (Server) - displays metrics
│           └── ActivityFeed.tsx (Client) - real-time updates, useEffect
\`\`\`

For each component, document:
- **Why Server or Client?** - Justify the boundary decision
- **Props passed across boundary** - Must be serializable for Server→Client
- **Data fetching location** - Move to nearest Server Component ancestor

# SEO & Metadata Audit

App Router uses the Metadata API instead of next/head. Audit:

1. **Page-level metadata:** Title, description, openGraph, twitter cards
2. **Dynamic metadata:** generateMetadata for dynamic routes
3. **Structured data:** JSON-LD scripts that need migration
4. **Canonical URLs:** Ensure proper canonical handling
5. **Robots/sitemap:** Check for custom implementations

Create a metadata migration map:
| Route | Current (next/head) | Target (Metadata API) | Dynamic? |
|-------|--------------------|-----------------------|----------|
| /home | title, description | metadata export | No |
| /blog/[slug] | dynamic title | generateMetadata | Yes |

# Rendering Strategy Audit

Document current rendering behavior and ensure it's preserved:

| Route | Current Strategy | Data Pattern | App Router Equivalent |
|-------|-----------------|--------------|----------------------|
| /home | SSG | getStaticProps | Static Server Component |
| /dashboard | SSR | getServerSideProps | Dynamic Server Component |
| /blog/[slug] | ISR (60s) | getStaticProps + revalidate | fetch with revalidate: 60 |
| /products | CSR | useEffect + fetch | Client Component or Route Handler |

**Critical:** Changing rendering strategy can affect:
- Time to First Byte (TTFB)
- Caching behavior at CDN
- Database/API load patterns
- User experience during navigation

# Migration Phases to Plan

## Phase 1: Foundational Setup
- Create app/ directory and root layout (app/layout.tsx)
- Migrate _app.js: global styles, providers (as Client Components), metadata
- Migrate _document.js: HTML structure, fonts (next/font)
- Create app/not-found.tsx (from 404.js)
- Create app/error.tsx (from _error.js, 500.js) - requires 'use client'
- Create app/loading.tsx (optional)

## Phase 2: Route Migration (order by complexity)
Static pages first, then dynamic routes, then catch-all routes.

## Phase 3: API Routes
Convert to Route Handlers with named HTTP method exports.

## Phase 4: Layout Optimization
Identify shared layouts and create nested layout structure.

## Phase 5: Special Features
- Update middleware route matchers
- Update next.config.js redirects/rewrites
- Ensure next/image and next/font usage

## Phase 6: Cleanup
Remove pages/ directory after verification.

# Transformation Patterns Reference

## Routing
| Pages Router | App Router |
|-------------|------------|
| pages/*.js | app/*/page.js |
| pages/[id].js | app/[id]/page.js |
| pages/[...slug].js | app/[...slug]/page.js |
| pages/[[...slug]].js | app/[[...slug]]/page.js |
| pages/api/*.js | app/api/*/route.js |

## Data Fetching

**getServerSideProps → async Server Component:**
\`\`\`typescript
// Before
export async function getServerSideProps() {
  const data = await fetchData()
  return { props: { data } }
}

// After
export default async function Page() {
  const data = await fetchData()
  return <Component data={data} />
}
\`\`\`

**getStaticProps → Server Component with caching:**
\`\`\`typescript
// Before
export async function getStaticProps() {
  const data = await fetchData()
  return { props: { data }, revalidate: 60 }
}

// After
export default async function Page() {
  const data = await fetch(url, { next: { revalidate: 60 } })
  return <Component data={data} />
}
\`\`\`

**getStaticPaths → generateStaticParams:**
\`\`\`typescript
// Before
export async function getStaticPaths() {
  const paths = await getPaths()
  return { paths, fallback: false }
}

// After
export async function generateStaticParams() {
  const paths = await getPaths()
  return paths.map(p => ({ slug: p.slug }))
}
\`\`\`

## Special Files
| Pages Router | App Router |
|-------------|------------|
| _app.js | layout.js (root layout) |
| _document.js | layout.js (HTML + metadata API) |
| _error.js | error.tsx ('use client') |
| 404.js | not-found.tsx |
| 500.js | error.tsx |

## Component Patterns

**Server Components (default):** No directive needed.

**Client Components:** Add 'use client' when using:
- useState, useEffect, useContext
- Event handlers (onClick, onChange)
- Browser APIs (localStorage, window)

**Provider extraction:**
\`\`\`typescript
// app/providers.tsx
'use client'
export function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider><AuthProvider>{children}</AuthProvider></ThemeProvider>
}

// app/layout.tsx
import { Providers } from './providers'
export default function RootLayout({ children }) {
  return <html><body><Providers>{children}</Providers></body></html>
}
\`\`\`

## API Route Handlers
\`\`\`typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json(await getUsers())
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  return NextResponse.json(await createUser(body), { status: 201 })
}
\`\`\`

# Important Considerations

- Pages Router and App Router can coexist during migration
- Test after each phase before proceeding
- Commit after each successful migration step
- Watch for hydration mismatches at Server/Client boundaries
- Update middleware route matchers for app/ paths
- Client-side env vars need NEXT_PUBLIC_ prefix
- **Preserve all TypeScript types** - don't lose type safety
- **Verify functionality parity** - migrated routes must behave identically
- **Document any behavior changes** - if something must change, note it explicitly

# Output Requirements

Please analyze the project and create a detailed, phased migration plan. Use todos to track your analysis progress. For each phase include:

1. **Specific files to modify** with transformation notes
2. **Component boundary tree** showing Server/Client decisions
3. **Metadata migration map** for SEO preservation
4. **Rendering strategy table** ensuring behavior parity
5. **Estimated effort** (time estimate)
6. **Risk level** (Low/Medium/High) with justification
7. **Verification steps** to confirm successful migration
`.trim()
}
