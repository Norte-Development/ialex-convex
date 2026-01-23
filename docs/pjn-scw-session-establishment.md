# PJN SCW Session Establishment Fix

## Problem Discovery

During troubleshooting of the PJN case history search functionality, we discovered that the search form for **private cases** is located within the "Personalizar Resultados" (Customize Results) section on the `consultaListaRelacionados.seam` page. This form allows searching by:

- **Jurisdicción** (Jurisdiction dropdown)
- **Número/Año** (Case Number and Year textboxes)
- **Carátula** (Case Title textbox)
- **Situación** (Status dropdown)

The form is submitted via the "Consultar" (Search) button, which performs a POST request to the same page.

## Root Cause

The authentication flow (`performPjnLogin`) was only establishing SSO (Single Sign-On) cookies but **never visited the SCW portal** to establish the JSF session cookie (`JSESSIONID`). The SCW portal is a separate JavaServer Faces (JSF) application that requires:

1. SSO authentication cookies (from Keycloak)
2. A separate SCW session cookie (`JSESSIONID`) obtained by visiting the SCW portal

Without the `JSESSIONID`, the case history search would fail with authentication errors or redirect loops.

## Solution

### Updated Authentication Flow

Modified `pjnAuth.ts` to establish an SCW session immediately after SSO login completes. This ensures that when users authenticate, they receive both SSO cookies and the SCW `JSESSIONID` cookie in a single authentication flow.

#### Code Change

**File:** `apps/pjn-scraper/src/lib/pjnAuth.ts`

```typescript
// After SSO login completes and we've verified we reached the PJN portal...

// Basic sanity check that we reached the PJN portal.
if (!lastUrl.startsWith(config.pjnPortalBaseUrl)) {
  logger.warn("PJN login ended on unexpected URL", {
    url: lastUrl,
    expectedBase: config.pjnPortalBaseUrl,
  });
}

// NEW: Navigate to the SCW portal to establish a JSESSIONID for the case history search.
logger.info("Establishing SCW session by navigating to consultaListaRelacionados.seam");
try {
  await page.goto(
    "https://scw.pjn.gov.ar/scw/consultaListaRelacionados.seam",
    { waitUntil: "networkidle", timeout: 30000 }
  );
  const scwUrl = page.url();
  logger.info("SCW session established", { scwUrl });
} catch (scwError) {
  // Log but don't fail the entire login if SCW navigation has issues
  logger.warn("Failed to navigate to SCW portal for JSESSIONID, continuing anyway", {
    error: scwError instanceof Error ? scwError.message : String(scwError),
  });
}

// Capture cookies from the browser context (now includes SCW JSESSIONID)
const cookies = await context.cookies();
```

### How It Works

1. **SSO Login**: User authenticates via Keycloak SSO, receiving SSO cookies
2. **SCW Session Establishment**: Browser navigates to `consultaListaRelacionados.seam`, which triggers:
   - SSO redirect flow (if needed)
   - SCW application session creation
   - `JSESSIONID` cookie issuance
3. **Cookie Capture**: All cookies (SSO + SCW) are captured and stored in the session

### Existing Case History Search Flow

The case history search implementation (`caseHistorySearch.ts`) already had logic to handle SCW sessions, but it was designed to work around missing `JSESSIONID` cookies by going through the SSO flow again. With this fix, that fallback should rarely be needed.

#### Key Functions

**`establishScwSession()`** - Establishes SCW session and extracts ViewState:

```typescript
async function establishScwSession(
  session: SessionState,
  fre: string
): Promise<ScwSessionResult> {
  let currentCookies = session.cookies ? [...session.cookies] : [];
  
  // If we don't have an SCW session cookie yet, start from the SSO auth URL
  // to trigger the OpenID Connect flow. Otherwise, go directly to the SCW page.
  let currentUrl = hasScwJsessionId(currentCookies)
    ? CASE_HISTORY_SEARCH_URL
    : config.pjnScwSsoAuthUrl;

  // ... manual redirect following and cookie collection ...
  
  // Extract ViewState from HTML
  const html = await response.text();
  const viewState = extractViewState(html);
  
  return {
    cookies: currentCookies,
    viewState,
    html,
  };
}
```

**`buildSearchFormBody()`** - Builds the JSF form payload:

```typescript
function buildSearchFormBody(
  options: CaseHistorySearchOptions,
  viewState: string
): string {
  const params = new URLSearchParams();

  // JSF form identifier – required to target the correct component.
  params.set("j_idt83:consultaExpediente", "j_idt83:consultaExpediente");

  // Jurisdiction / camara
  params.set("j_idt83:consultaExpediente:camara", options.jurisdiction);

  // Case number (numeric portion)
  params.set("j_idt83:consultaExpediente:j_idt116:numero", options.caseNumber);

  // Year
  params.set("j_idt83:consultaExpediente:j_idt118:anio", String(options.year));

  // Optional filters we currently leave blank.
  params.set("j_idt83:consultaExpediente:caratula", "");
  params.set("j_idt83:consultaExpediente:situation", "");

  // Submit button identifier.
  params.set(
    "j_idt83:consultaExpediente:consultaFiltroSearchButtonSAU",
    "Consultar"
  );

  // The critical ViewState token from the GET request
  params.set("javax.faces.ViewState", viewState);

  return params.toString();
}
```

**`fetchCaseHistorySearchHtml()`** - Two-step search flow:

```typescript
async function fetchCaseHistorySearchHtml(
  session: SessionState,
  options: CaseHistorySearchOptions
): Promise<RawCaseHistorySearchResult> {
  // Step 1: Establish SCW session and get ViewState
  logger.info("Step 1: Establishing SCW session", { fre });
  const scwSession = await establishScwSession(session, fre);

  // Step 2: Submit the search form with the ViewState
  logger.info("Step 2: Submitting search form", { fre });
  
  const body = buildSearchFormBody(options, scwSession.viewState);
  
  const response = await fetch(CASE_HISTORY_SEARCH_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: scwSession.cookies.join("; "),
      // ... other headers ...
    },
    body,
  });
  
  // ... handle response ...
}
```

## Testing

After this change, users need to **re-authenticate** to receive the new cookies that include the SCW `JSESSIONID`. Once re-authenticated:

1. The session will have both SSO cookies and SCW `JSESSIONID`
2. `hasScwJsessionId()` will return `true`
3. `establishScwSession()` will go directly to the search page (skipping SSO redirect)
4. The search form can be submitted successfully

## Browser Investigation Findings

During browser investigation, we confirmed:

1. The "Personalizar Resultados" section contains a collapsible search form
2. The form fields match the JSF component IDs used in `buildSearchFormBody()`
3. Submitting the form with FRE 3852/2020 successfully returned 67 related expedientes
4. The form requires a valid `javax.faces.ViewState` token obtained from the page HTML

## Related Files

- `apps/pjn-scraper/src/lib/pjnAuth.ts` - Authentication flow (modified)
- `apps/pjn-scraper/src/lib/caseHistorySearch.ts` - Case history search implementation
- `apps/pjn-scraper/src/routes/caseHistory.ts` - API route handler
- `apps/pjn-scraper/src/config.ts` - Configuration (includes `pjnScwSsoAuthUrl`)

## Notes

- The SCW portal uses cookie-based authentication, not JWT bearer tokens
- The `Authorization` header is intentionally **not** included in SCW requests
- The fix is backward compatible - if SCW navigation fails, the login still succeeds (with a warning)
- Existing sessions without SCW cookies will still work via the fallback SSO flow in `establishScwSession()`
