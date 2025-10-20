#!/bin/bash
REDIS_URL="${redis://default:3BjbuCWsvIIL6CEuUrWQOHx0sEfQv3GOcpmVV0yBZibvVlWqTIru9QLnLDvO2ZMu@31.97.20.213:6379/0}"

echo "🧹 Clearing BullMQ queues..."

redis-cli -u $REDIS_URL <<EOF
DEL bull:document-processing:wait
DEL bull:document-processing:active
DEL bull:document-processing:paused
DEL bull:document-processing:delayed
DEL bull:document-processing:failed
DEL bull:document-processing:completed

DEL bull:library-document-processing:wait
DEL bull:library-document-processing:active
DEL bull:library-document-processing:paused
DEL bull:library-document-processing:delayed
DEL bull:library-document-processing:failed
DEL bull:library-document-processing:completed
EOF

echo "🗑️  Clearing job state data..."
redis-cli -u $REDIS_URL --scan --pattern 'job:state:*' | xargs -L 100 redis-cli -u $REDIS_URL DEL

echo "🗑️  Clearing BullMQ metadata..."
redis-cli -u $REDIS_URL --scan --pattern 'bull:document-processing:*' | xargs -L 100 redis-cli -u $REDIS_URL DEL
redis-cli -u $REDIS_URL --scan --pattern 'bull:library-document-processing:*' | xargs -L 100 redis-cli -u $REDIS_URL DEL

echo "✅ Queues cleared successfully!"