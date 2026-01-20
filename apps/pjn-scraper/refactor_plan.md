# PJN Scraper Service Refactor Plan

## Overview

The current `pjn-scraper` service works well for its intended function (scraping PJN Portal events). However, to support multiple scrapers for different sources (similar use case but potentially completely different APIs and websites), we need to refactor the architecture to be more modular and scalable.

## Current State Analysis

The current implementation has PJN-specific code scattered throughout:

- **Config**: PJN-specific URLs (`pjnApiBaseUrl`, `pjnSsoBaseUrl`, etc.)
- **HTTP Client**: `PjnHttpClient` class hardcoded for PJN API
- **Authentication**: `performPjnLogin`, `refreshPjnTokens` are PJN-specific
- **Routes**: `/scrape/events` and `/reauth` assume PJN semantics
- **Session Storage**: Currently keyed only by `userId` (implicitly PJN)
- **Document Storage**: Hardcoded `pjn/` prefix in GCS paths

## High-Level Goals

1. **Decouple infrastructure from scraper implementations**: Separate the core server, auth, storage, and logging from specific scraper logic
2. **Make adding new scrapers easy**: Adding a new scraper should be mostly "plug in a new adapter + config" without touching core routes or Convex integration
3. **Maintain backward compatibility**: Keep the external API stable (or add a clean v2) so the application doesn't break when we generalize

## Proposed Architecture: "Scraper Engine + Per-Source Plugins"

### Core Concept

- **Core Layer** (source-agnostic):
  - Express server, service auth middleware, logging, health checks
  - Generic scrape orchestration: pagination loops, PDF handling, GCS uploads, stats
  - Generic session persistence: "source + user → session"
  
- **Source Adapters** (per scraper):
  - Know how to:
    - Authenticate a user (via API or browser automation)
    - Maintain/refresh a session
    - Fetch "events" or "items" and normalize to a common shape
    - Optionally download documents

The core engine calls `scraper.fetchEvents()`, `scraper.downloadPdf()`, `scraper.ensureValidSession()`, and each source implements that interface, hiding its own API/HTML quirks.

## Proposed Folder Structure

```
src/
  server.ts
  config.ts
  middleware/
    auth.ts
    logging.ts
  lib/
    sessionStore.ts        // generalized to support multiple sources
    storage.ts             // generalized doc storage
    scraperEngine.ts       // core pagination + PDF pipeline
    types.ts               // shared core types (SourceId, NormalizedEvent, etc.)
  sources/
    pjn/
      config.ts            // PJN-specific URLs, page sizes, etc.
      httpClient.ts        // old PjnHttpClient moved here
      auth.ts              // performPjnLogin, refreshPjnTokens, etc.
      scraper.ts           // PJN implementation of SourceScraper
    anotherSource/
      config.ts
      httpClient.ts
      auth.ts
      scraper.ts
    registry.ts            // maps "pjn" → pjnScraper, "x" → otherScraper
  routes/
    health.ts
    scrape.ts              // generic: /sources/:sourceId/events (v2)
    reauth.ts              // generic: /sources/:sourceId/reauth (v2)
    // legacy:
    pjnEvents.ts           // thin wrapper to keep /scrape/events working
    pjnReauth.ts
  types/
    api.ts                 // external API; extended with a "source" field or param
```

## Core Abstractions & Interfaces

### 1. Core Types (Source-Agnostic)

Define shared types in `lib/types.ts` or `types/api.ts`:

```typescript
// Shared across all scrapers
export type SourceId = "pjn" | "anotherSource" | string;

export interface SourceSessionState {
  // Source-specific session data (cookies, tokens, etc.)
  data: Record<string, unknown>;
}

export interface NormalizedEvent {
  sourceId: SourceId;
  eventId: string;
  fre: string | null;
  timestamp: string;
  category: string;
  description: string;
  hasDocument: boolean;
  gcsPath?: string;
  rawPayload: Record<string, unknown>;
}
```

### 2. Scraper Interface

All sources must implement this interface (in `src/lib/scraperEngine.ts` or `src/sources/types.ts`):

```typescript
export interface ScrapeEventsParams {
  userId: string;
  since?: string;
  lastEventId?: string;
  maxPages?: number;
}

export interface ScrapeEventsResult {
  events: NormalizedEvent[];
  fetchedPages: number;
}

export interface SourceScraper {
  id: SourceId;

  // Obtain a valid session (load + refresh, or fail with auth required)
  ensureValidSession(userId: string): Promise<SourceSessionState | null>;

  // Main events fetch, including source-specific pagination
  scrapeEvents(
    params: ScrapeEventsParams,
    session: SourceSessionState,
  ): Promise<ScrapeEventsResult>;

  // Optional document download step; core engine will call this per event
  downloadPdf?(
    event: NormalizedEvent,
    session: SourceSessionState,
  ): Promise<Buffer | null>;
}
```

### 3. Scraper Registry

A registry so routes don't need to know about individual scrapers:

```typescript
const scrapers: Record<SourceId, SourceScraper> = {
  pjn: pjnScraper,
  // anotherSource: anotherSourceScraper,
};

export function getScraper(sourceId: SourceId): SourceScraper | undefined {
  return scrapers[sourceId];
}
```

## Generalizing Session & Storage

### Session Store Changes

Current `SessionStore` is mostly generic but keyed only by `userId`. Refactor to:

- **Key by (sourceId, userId)** instead of just `userId`
- Allow storing arbitrary JSON for each source

**Current path:**
```typescript
private getSessionPath(userId: string): string {
  return `${userId}/${config.sessionFileName}`;
}
```

**New shape:**
```typescript
private getSessionPath(sourceId: SourceId, userId: string): string {
  return `${sourceId}/${userId}/${config.sessionFileName}`;
}
```

**New API:**
```typescript
async loadSession(sourceId: SourceId, userId: string): Promise<SourceSessionState | null> { ... }
async saveSession(sourceId: SourceId, userId: string, session: SourceSessionState): Promise<boolean> { ... }
```

Each `SourceScraper` is responsible for **marshalling** its own `SessionState` to/from `SourceSessionState.data`.

### GCS Document Storage Changes

Generalize `GcsStorage` to include `sourceId` in the path:

- **From:** `pjn/${userId}/${eventId}.pdf`
- **To:** `${sourceId}/${userId}/${eventId}.pdf`

**New API:**
```typescript
async uploadPdf(
  sourceId: SourceId,
  userId: string,
  eventId: string,
  pdfBuffer: Buffer
): Promise<string> { ... }

async pdfExists(
  sourceId: SourceId,
  userId: string,
  eventId: string
): Promise<boolean> { ... }
```

The PJN implementation simply calls with `sourceId = "pjn"`.

## Centralizing Scrape Orchestration

Currently `/routes/events.ts` contains:
- Request validation
- Session loading
- Token refresh logic
- Pagination loop
- Event normalization
- PDF processing

Move the **skeleton of that flow** into a reusable engine function, e.g. `runScrape` in `lib/scraperEngine.ts`:

```typescript
export async function runScrape({
  sourceId,
  userId,
  since,
  lastEventId,
}: {
  sourceId: SourceId;
  userId: string;
  since?: string;
  lastEventId?: string;
}): Promise<{
  events: NormalizedEvent[];
  stats: { fetchedPages: number; newEvents: number };
}> {
  const scraper = getScraper(sourceId);
  if (!scraper) throw new Error(`Unknown source: ${sourceId}`);

  const session = await scraper.ensureValidSession(userId);
  if (!session) {
    // propagate AUTH_REQUIRED semantics to the route layer
    throw new AuthRequiredError("Session not found or invalid");
  }

  const scrapeResult = await scraper.scrapeEvents(
    { userId, since, lastEventId, maxPages: config.maxPagesPerSync },
    session,
  );

  // Optional PDF processing via scraper.downloadPdf + GcsStorage
  // (logic similar to your current loop, but generic)

  return {
    events: scrapeResult.events,
    stats: {
      fetchedPages: scrapeResult.fetchedPages,
      newEvents: scrapeResult.events.length,
    },
  };
}
```

Then **routes become very thin**:
- New generic endpoint (v2): `POST /sources/:sourceId/scrape/events`
- Old `POST /scrape/events` just calls `runScrape` with `sourceId = "pjn"` to keep existing clients working

## Generalizing Reauth

Move PJN login into a `SourceScraper` (or a separate `SourceAuthenticator` interface):

- PJN implementation wraps `performPjnLogin` and writes the session via `SessionStore`
- New route: `POST /sources/:sourceId/reauth` or `POST /reauth` with `{ sourceId, userId, username, password }`
- Keep existing `/reauth` as a **PJN alias** for backward compatibility

The core `reauth` handler:
1. Gets the `scraper` from `sourceId`
2. Delegates to a `reauth`/`login` method on that scraper (PJN: use Playwright; other scrapers: maybe pure HTTP)
3. Persists the resulting session state via the shared `SessionStore`

## Configuration Strategy

Current `config` is mostly PJN-specific. For multi-source:

- **Keep global settings**: port, nodeEnv, serviceAuthSecret, GCS buckets, documentProcessorUrl, retry/timeout defaults
- **Introduce per-source config object**:

```typescript
export interface SourceConfig {
  id: SourceId;
  displayName: string;
  eventsPageSize: number;
  maxPagesPerSync: number;
  // source-specific URLs, endpoints, SSO info, etc.
  baseUrl: string;
  eventsEndpoint: string;
  pdfEndpoint?: string;
  sso?: {
    baseUrl: string;
    authUrl: string;
    clientId: string;
  };
}

export const sourcesConfig: Record<SourceId, SourceConfig> = {
  pjn: {
    id: "pjn",
    displayName: "PJN Portal",
    eventsPageSize: config.eventsPageSize,
    maxPagesPerSync: config.maxPagesPerSync,
    baseUrl: config.pjnApiBaseUrl,
    eventsEndpoint: config.pjnEventsEndpoint,
    pdfEndpoint: config.pjnPdfEndpoint,
    sso: {
      baseUrl: config.pjnSsoBaseUrl,
      authUrl: config.pjnSsoAuthUrl,
      clientId: "pjn-portal",
    },
  },
  // anotherSource: { ... },
};
```

Each `SourceScraper` reads its configuration from here.

## Phased Refactor Plan

### Phase 1: Introduce Abstractions Without Breaking Behavior

1. **Add core types**: Create `SourceId`, `SourceScraper` interface, `ScrapeEventsParams/Result` types
2. **Add scraper registry**: Create `sources/registry.ts` and register a PJN adapter, but internally have PJN adapter just wrap your current functions (no logic move yet)
3. **Extend SessionStore & GcsStorage APIs**: Add `sourceId` parameter, but keep existing single-source overloads so nothing breaks
4. **Create `runScrape` function**: Add `lib/scraperEngine.ts` with `runScrape` that calls existing PJN functions internally

### Phase 2: Move PJN-Specific Code into PJN Adapter

5. **Move PJN code**: Move `PjnHttpClient`, `refreshPjnTokens`, `performPjnLogin`, and PJN normalization into `sources/pjn/*`
6. **Implement `pjnScraper`**: Create `sources/pjn/scraper.ts` that:
   - Uses `SessionStore` for PJN sessions (with `sourceId="pjn"`)
   - Implements `ensureValidSession`, `scrapeEvents`, and `downloadPdf` using existing logic
7. **Update `runScrape`**: Make it use only the `SourceScraper` interface instead of directly calling PJN utilities

### Phase 3: Route Generalization & API Evolution

8. **Add new generic endpoints**:
   - `POST /sources/:sourceId/scrape/events` → uses `runScrape`
   - `POST /sources/:sourceId/reauth` → uses `scraper`'s login method
9. **Keep backward compatibility**: Keep existing `POST /scrape/events` and `POST /reauth` as shims that call the PJN scraper with `sourceId="pjn"`

### Phase 4: Add Second Scraper as Proof of Architecture

10. **Implement second scraper**: Create `sources/anotherSource/*` with:
    - Its own login, events fetch, normalization, PDF strategy
    - Register in `sources/registry.ts`
11. **Add tests**: Verify that:
    - Calling `runScrape` with `sourceId="pjn"` and `sourceId="anotherSource"` works
    - Sessions are isolated per source
    - Document paths are isolated per source

## Adding a New Scraper (Future)

To add `AnotherCourt` in the future, you would:

1. **Add config**: Add environment variables and an entry in `sourcesConfig`
2. **Implement scraper**: Create `sources/anotherCourt/scraper.ts` that implements `SourceScraper` interface (using HTTP, Playwright, or both)
3. **Register it**: Add it to `sources/registry.ts`

All existing routes, health checks, GCS setup, and Convex integration stay the same. Clients just start calling `sourceId = "anotherCourt"` instead of `"pjn"`.

## Benefits

- **Separation of concerns**: Core infrastructure is separate from scraper-specific logic
- **Easy to extend**: Adding a new scraper is mostly isolated work
- **Testability**: Each scraper can be tested independently
- **Maintainability**: Changes to one scraper don't affect others
- **Backward compatibility**: Existing PJN integration continues to work

## Migration Notes

- The refactor maintains backward compatibility by keeping existing endpoints
- Convex integration (`apps/application/convex/pjn/sync.ts`) should continue to work without changes initially
- Eventually, Convex can be updated to use the new generic endpoints with `sourceId` parameter
- Session storage migration: Existing PJN sessions will need to be migrated from `userId/` to `pjn/userId/` paths (or handled via compatibility layer)

