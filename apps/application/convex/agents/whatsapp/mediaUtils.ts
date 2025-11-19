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
        gcsBucket: v.string(),
        gcsObject: v.string(),
    },
    handler: async (ctx, { gcsBucket, gcsObject }) => {
        const { url } = await ctx.runAction(
            internal.utils.gcs.generateGcsV4SignedUrlAction,
            {
              bucket: gcsBucket,
              object: gcsObject,
              expiresSeconds: 900,
              method: "GET",
            },
          );


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

type ImageContentPart = {
  type: "image";
  image: string;
  mimeType: string;
};

type ImageContentPartOrNull = ImageContentPart | null;

/**
 * Generates signed URLs for image media items to be used by the LLM.
 * Returns an array of image content parts, with null entries for failed images.
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
                    const expiresSeconds = Number(
                        process.env.GCS_DOWNLOAD_URL_TTL_SECONDS || 900,
                    );
                    const { url }: { url: string } = await ctx.runAction(
                        internal.utils.gcs.generateGcsV4SignedUrlAction,
                        {
                            bucket: m.gcsBucket,
                            object: m.gcsObject,
                            expiresSeconds,
                            method: "GET",
                        },
                    );
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