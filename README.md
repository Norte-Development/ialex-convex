# Welcome to your Convex + React (Vite) + Clerkapp

This is a [Convex](https://convex.dev/) project created with [`npm create convex`](https://www.npmjs.com/package/create-convex).

After the initial setup (<2 minutes) you'll have a working full-stack app using:

- Convex as your backend (database, server logic)
- [React](https://react.dev/) as your frontend (web page interactivity)
- [Vite](https://vitest.dev/) for optimized web hosting
- [Tailwind](https://tailwindcss.com/) for building great looking accessible UI
- [Clerk](https://clerk.com/) for authentication

## Get started

If you just cloned this codebase and didn't use `npm create convex`, run:

```
npm install
npm run dev
```

If you're reading this README on GitHub and want to use this template, run:

```
npm create convex@latest -- -t react-vite-clerk
```

Then:

1. Follow steps 1 to 3 in the [Clerk onboarding guide](https://docs.convex.dev/auth/clerk#get-started)
2. Paste the Issuer URL as `CLERK_JWT_ISSUER_DOMAIN` to your dev deployment environment variable settings on the Convex dashboard (see [docs](https://docs.convex.dev/auth/clerk#configuring-dev-and-prod-instances))
3. Paste your publishable key as `VITE_CLERK_PUBLISHABLE_KEY="<your publishable key>"` to the `.env.local` file in this directory.

If you want to sync Clerk user data via webhooks, check out this [example repo](https://github.com/thomasballinger/convex-clerk-users-table/).

## Document Processor Microservice

Run the external processor (Express) alongside Convex during development in another terminal:

```
pnpm dev:processor
```

### Environment Setup for Document Processor

1. Copy the environment template:
```bash
cp apps/document-processor/env.example apps/document-processor/.env
```

2. Configure the required environment variables in `apps/document-processor/.env`:
   - `OPENAI_API_KEY`: Your OpenAI API key for embeddings
   - `QDRANT_URL`: Qdrant vector database URL (default: http://localhost:6333)
   - `QDRANT_API_KEY`: Qdrant API key (if required)
   - `MISTRAL_API_KEY`: Your Mistral API key for OCR
   - `MISTRAL_OCR_ENDPOINT`: Mistral OCR endpoint URL
   - `REDIS_URL`: Redis connection URL (default: redis://localhost:6379)
   - `HMAC_SECRET`: Secret for webhook signature verification

3. Ensure Redis and Qdrant are running locally or update the URLs to point to your services.

## Learn more

To learn more about developing your project with Convex, check out:

- The [Tour of Convex](https://docs.convex.dev/get-started) for a thorough introduction to Convex principles.
- The rest of [Convex docs](https://docs.convex.dev/) to learn about all Convex features.
- [Stack](https://stack.convex.dev/) for in-depth articles on advanced topics.

## Join the community

Join thousands of developers building full-stack apps with Convex:

- Join the [Convex Discord community](https://convex.dev/community) to get help in real-time.
- Follow [Convex on GitHub](https://github.com/get-convex/), star and contribute to the open-source implementation of Convex.
