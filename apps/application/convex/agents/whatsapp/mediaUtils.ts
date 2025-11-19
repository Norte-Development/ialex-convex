'use node';

import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import { createClient } from '@deepgram/sdk';
import { Storage } from "@google-cloud/storage";

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// Initialize GCS Storage client
const gcsStorage = new Storage({
    projectId: process.env.GCP_PROJECT_ID,
    credentials: {
        client_email: process.env.GCS_SIGNER_CLIENT_EMAIL,
        private_key: process.env.GCS_SIGNER_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
});

export const transcribeAction = internalAction({
    args: {
        threadId: v.string(),
        prompt: v.string(),
    },
    handler: async (ctx, { threadId, prompt }) => {
        return null;
    },
});

/**
 * Downloads media from Twilio and stores it in GCS
 * Returns the GCS bucket, object path, and metadata for the stored media
 */
export const downloadAndStoreTwilioMedia = internalAction({
    args: {
        mediaUrl: v.string(),
        contentType: v.string(),
        accountSid: v.string(),
        authToken: v.string(),
    },
    returns: v.object({
        gcsBucket: v.string(),
        gcsObject: v.string(),
        contentType: v.string(),
        size: v.number(),
    }),
    handler: async (ctx, { mediaUrl, contentType, accountSid, authToken }) => {
        const bucket = process.env.GCS_BUCKET;
        if (!bucket) {
            throw new Error('GCS_BUCKET environment variable not configured');
        }

        // Create Basic Auth header for Twilio API
        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        
        // Download media from Twilio
        const response = await fetch(mediaUrl, {
            headers: {
                'Authorization': `Basic ${auth}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to download media from Twilio: ${response.status} ${response.statusText}`);
        }

        // Get the media content as a buffer
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const size = buffer.length;

        // Generate a unique object path for WhatsApp media
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 15);
        const extension = contentType.split('/')[1] || 'bin'; // Extract extension from content type
        const objectPath = `whatsapp-media/${timestamp}-${randomId}.${extension}`;

        // Upload to GCS
        const gcsBucket = gcsStorage.bucket(bucket);
        const gcsFile = gcsBucket.file(objectPath);
        
        await gcsFile.save(buffer, {
            metadata: {
                contentType,
                source: 'whatsapp',
                originalMediaUrl: mediaUrl,
            },
        });

        console.log(`[WhatsApp Media] Uploaded to GCS: ${bucket}/${objectPath} (${size} bytes)`);

        // Schedule deletion after 1 day (24 hours = 86400000 ms)
        await ctx.scheduler.runAfter(
            24 * 60 * 60 * 1000, // 1 day in milliseconds
            internal.utils.gcs.deleteGcsObjectAction,
            {
                bucket,
                object: objectPath,
            }
        );

        console.log(`[WhatsApp Media] Scheduled deletion for ${bucket}/${objectPath} in 1 day`);

        return {
            gcsBucket: bucket,
            gcsObject: objectPath,
            contentType,
            size,
        };
    },
});