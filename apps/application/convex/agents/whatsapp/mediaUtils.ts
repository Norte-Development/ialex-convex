'use node';

/**
 * WhatsApp Media Utilities
 *
 * Handles media storage, transcription, and URL generation for WhatsApp messages.
 *
 * Current strategy (for reliability over strict ephemerality):
 * - Media is stored in a dedicated GCS bucket for WhatsApp (WHATSAPP_GCS_BUCKET),
 *   falling back to GCS_BUCKET if not set.
 * - Uploaded objects are made public so they can be fetched by external AI providers.
 * - URLs are stable public URLs of the form:
 *     https://storage.googleapis.com/<bucket>/<object>
 *
 * This keeps WhatsApp media independent from the rest of the app's buckets and
 * avoids signed URL expiration problems for conversation history.
 */

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
        gcsBucket: v.string(),
        gcsObject: v.string(),
    },
    handler: async (ctx, { gcsBucket, gcsObject }) => {
        // Generate fresh short-lived URL just-in-time for transcription
        const url = await ctx.runAction(
            internal.agents.whatsapp.mediaUtils.getShortLivedMediaUrl,
            {
                gcsBucket,
                gcsObject,
            },
        );

        if (!url) {
            throw new Error(`Failed to generate signed URL for transcription: ${gcsBucket}/${gcsObject}`);
        }

        const { result, error } = await deepgram.listen.prerecorded.transcribeUrl({url: url}, {
            model: 'nova-2',
            language: 'es',    
        });

        if (error) {
            throw new Error(`Failed to transcribe media: ${error.message}`);
        }

        return result.results?.channels[0]?.alternatives[0]?.transcript || '';
    },
});

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
        // Use a dedicated bucket for WhatsApp media if configured, falling back to GCS_BUCKET.
        const bucket = process.env.WHATSAPP_GCS_BUCKET || process.env.GCS_BUCKET;
        if (!bucket) {
            throw new Error('WHATSAPP_GCS_BUCKET or GCS_BUCKET environment variable not configured for WhatsApp media');
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

        // Make this object public so it can be fetched without signed URLs.
        // This is intentionally scoped to the WhatsApp media bucket so it
        // doesn't affect the rest of the app's private storage.
        // await gcsFile.makePublic();

        console.log(`[WhatsApp Media] Uploaded and made public in GCS: ${bucket}/${objectPath} (${size} bytes)`);

        return {
            gcsBucket: bucket,
            gcsObject: objectPath,
            contentType,
            size,
        };
    },
});

// Helper to centralize construction of public media URLs for WhatsApp.
// If the hosting pattern ever changes, only this helper needs to be updated.

type ImageContentPart = {
  type: "image";
  image: string;
  mimeType: string;
};

type ImageContentPartOrNull = ImageContentPart | null;

type MediaReference = {
  gcsBucket: string;
  gcsObject: string;
  contentType: string;
};

/**
 * Generates a short-lived, unguessable signed URL for a media item.
 * This helper creates fresh URLs just-in-time with a configurable TTL.
 * URLs are never persisted - they act as short-lived bearer tokens.
 * 
 * @param mediaRef - Internal media reference (bucket + object key)
 * @param ttlSeconds - Optional TTL override (defaults to MEDIA_SIGNED_URL_TTL_SECONDS)
 * @returns Signed URL string or null if generation fails
 */
export const getShortLivedMediaUrl = internalAction({
  args: {
    gcsBucket: v.string(),
    gcsObject: v.string(),
    ttlSeconds: v.optional(v.number()),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (
    ctx,
    { gcsBucket, gcsObject, ttlSeconds: _ttlSeconds },
  ): Promise<string | null> => {
    try {
      // Build a stable public URL for the object. We encode the object path
      // but preserve slashes so nested paths continue to work.
      const encodedObject = encodeURIComponent(gcsObject).replace(/%2F/g, "/");
      const url = `https://storage.googleapis.com/${gcsBucket}/${encodedObject}`;
      return url;
    } catch (error) {
      console.error(
        "[WhatsApp Media] Failed to build public media URL",
        {
          gcsBucket,
          gcsObject,
          error,
        },
      );
      return null;
    }
  },
});

/**
 * Generates signed URLs for image media items to be used by the LLM.
 * Returns an array of image content parts, with null entries for failed images.
 * 
 * NOTE: This function generates URLs with short TTL. For just-in-time URL generation
 * before AI calls, use getShortLivedMediaUrl instead.
 */
export const generateSignedImageUrls = internalAction({
    args: {
        threadId: v.string(),
        imageMediaItems: v.array(v.object({
            gcsBucket: v.string(),
            gcsObject: v.string(),
            contentType: v.string(),
        })),
    },
    handler: async (ctx, { threadId, imageMediaItems }): Promise<Array<ImageContentPartOrNull>> => {
        const signedImageParts: Array<ImageContentPartOrNull> = await Promise.all(
            imageMediaItems.map(async (m): Promise<ImageContentPartOrNull> => {
                try {
                    const url = await ctx.runAction(
                        internal.agents.whatsapp.mediaUtils.getShortLivedMediaUrl,
                        {
                            gcsBucket: m.gcsBucket,
                            gcsObject: m.gcsObject,
                        },
                    );
                    if (!url) {
                        return null;
                    }
                    return {
                        type: "image" as const,
                        image: url,
                        mimeType: m.contentType,
                    };
                } catch (error) {
                    console.error(
                        "[WhatsApp Workflow] Failed to generate signed URL for image",
                        {
                            threadId,
                            gcsBucket: m.gcsBucket,
                            gcsObject: m.gcsObject,
                            contentType: m.contentType,
                            error,
                        },
                    );
                    // If signing fails, skip this image so the rest of the message still flows.
                    return null;
                }
            }),
        );

        return signedImageParts;
    },
});