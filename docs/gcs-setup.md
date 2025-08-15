## Google Cloud Storage setup (development and production)

This guide sets up GCS buckets and CORS for direct browser uploads via signed URLs. The microservice will only consume short‑lived signed GET URLs (no GCP SDK dependency).

### 1) Prerequisites
- Install and authenticate: `gcloud auth login`
- Set project: `gcloud config set project <PROJECT_ID>`
- Enable services:
```bash
gcloud services enable storage.googleapis.com iamcredentials.googleapis.com
```

### 2) Create buckets (per environment)
Pick globally unique names (example names shown):
```bash
# Dev
gsutil mb -l us-central1 gs://ialex-docs-dev
gsutil versioning set on gs://ialex-docs-dev

# Prod
gsutil mb -l us-central1 gs://ialex-docs-prod
gsutil versioning set on gs://ialex-docs-prod
```

Optional lifecycle for older versions (30 days):
```bash
cat > lifecycle.json <<EOF
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {"isLive": false, "age": 30}
    }
  ]
}
EOF
gsutil lifecycle set lifecycle.json gs://ialex-docs-dev
gsutil lifecycle set lifecycle.json gs://ialex-docs-prod
rm lifecycle.json
```

### 3) Configure CORS for browser PUT/GET
Edit the CORS file in `configs/gcs/cors.json` to include your origins, then apply:
```bash
gsutil cors set configs/gcs/cors.json gs://ialex-docs-dev
gsutil cors set configs/gcs/cors.json gs://ialex-docs-prod
gsutil cors get gs://ialex-docs-dev
```

### 4) Service account for Convex (signing URLs only)
Convex will mint signed PUT/GET URLs; the microservice will use only the signed GET (no GCP creds).

Create service account and key (if not using workload identity):
```bash
gcloud iam service-accounts create convex-signer \
  --display-name="Convex Signed URL Service"

gcloud storage buckets add-iam-policy-binding gs://ialex-docs-dev \
  --member=serviceAccount:convex-signer@$(gcloud config get-value project).iam.gserviceaccount.com \
  --role=roles/storage.objectCreator

gcloud storage buckets add-iam-policy-binding gs://ialex-docs-dev \
  --member=serviceAccount:convex-signer@$(gcloud config get-value project).iam.gserviceaccount.com \
  --role=roles/storage.objectViewer

gcloud storage buckets add-iam-policy-binding gs://ialex-docs-prod \
  --member=serviceAccount:convex-signer@$(gcloud config get-value project).iam.gserviceaccount.com \
  --role=roles/storage.objectCreator

gcloud storage buckets add-iam-policy-binding gs://ialex-docs-prod \
  --member=serviceAccount:convex-signer@$(gcloud config get-value project).iam.gserviceaccount.com \
  --role=roles/storage.objectViewer

# Optional: create JSON key for local dev (store securely; use Convex env secrets in prod)
gcloud iam service-accounts keys create convex-signer.json \
  --iam-account=convex-signer@$(gcloud config get-value project).iam.gserviceaccount.com
```

Required Convex environment variables (set in Convex dashboard/CLI):
- `GCS_BUCKET` (e.g., `ialex-docs-dev`)
- `GCS_SIGNER_CLIENT_EMAIL` (service account email)
- `GCS_SIGNER_PRIVATE_KEY` (PEM; escape newlines if needed)
- `GCS_UPLOAD_URL_TTL_SECONDS` (e.g., `900`)
- `GCS_DOWNLOAD_URL_TTL_SECONDS` (e.g., `900`)

Object name convention (store alongside the document record):
```
tenants/{tenantId}/cases/{caseId}/documents/{documentId}/{timestamp}-{originalFileName}
```

### 5) Microservice requirements
No GCP configuration required. The Convex processing action will pass a short‑lived signed GET URL as `signedUrl`.

### 6) Verification
```bash
# Upload test file via signed PUT (example; use app flow in practice)
curl -X PUT -H "Content-Type: text/plain" --data-binary @README.md "<SIGNED_PUT_URL>"

# Fetch via signed GET
curl -I "<SIGNED_GET_URL>"
```

If CORS is correct, browser uploads from your dev origin should succeed with preflight handled by GCS, and iframes/images can render from signed GET URLs.


