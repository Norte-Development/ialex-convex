#!/bin/bash
export PROJECT_ID=568491393559
export SERVICE_ACCOUNT="${PROJECT_ID}-compute@developer.gserviceaccount.com"

SECRETS=(
  "deepgram-api-key"
  "mistral-key"
  "openai-key"
  "redis-url"
  "qdrant-url"
  "qdrant-key"
  "hmac-secret"
  "convex-site-url"
)

for SECRET in "${SECRETS[@]}"; do
  echo "Granting access to $SECRET..."
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$PROJECT_ID
done

echo "✅ All permissions granted!"