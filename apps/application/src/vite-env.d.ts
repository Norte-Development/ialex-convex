/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL: string
  readonly VITE_CLERK_PUBLISHABLE_KEY: string
  readonly VITE_STRIPE_PRICE_PREMIUM_INDIVIDUAL: string
  readonly VITE_STRIPE_PRICE_PREMIUM_TEAM: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
