'use node'
// Minimal GCS V4 signed URL generator using Web Crypto (RSASSA-PKCS1-v1_5 + SHA-256)
// Works in Convex function/HTTP action environments without GCP SDKs.
import { Storage } from "@google-cloud/storage";
import { internalAction } from "../../../_generated/server";
import { v } from "convex/values";

export const storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID,
    credentials: {
        client_email: process.env.GCS_SIGNER_CLIENT_EMAIL,
        private_key: process.env.GCS_SIGNER_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
});

function encodeRfc3986(str: string): string {
  return encodeURIComponent(str).replace(/%2F/g, "/");
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

function parsePkcs8Pem(pem: string): ArrayBuffer {
  const clean = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\r?\n|\s/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const keyData = parsePkcs8Pem(pem);
  return crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function rsaSignHex(privateKeyPem: string, message: string): Promise<string> {
  const key = await importPrivateKey(privateKeyPem);
  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(message)
  );
  return toHex(sig);
}

function formatDate(date: Date): { yyyymmdd: string; amzdate: string } {
  const pad = (n: number, w = 2) => n.toString().padStart(w, "0");
  const yyyy = date.getUTCFullYear();
  const mm = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const mi = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  return { yyyymmdd: `${yyyy}${mm}${dd}`, amzdate: `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z` };
}

export async function generateGcsV4SignedUrl(params: {
  method: "GET" | "PUT" | "DELETE";
  bucket: string;
  object: string;
  expiresSeconds: number;
  contentType?: string;
}): Promise<string> {
  const { method, bucket, object, expiresSeconds, contentType } = params;
  const action = method === "PUT" ? "write" : method === "GET" ? "read" : "delete";
  const options: any = {
    version: "v4",
    action,
    expires: Date.now() + expiresSeconds * 1000,
  };
  if (method === "PUT" && contentType) {
    options.contentType = contentType;
  }
  const [url] = await storage.bucket(bucket).file(object).getSignedUrl(options);
  return url;
}

export const generateGcsV4SignedUrlAction = internalAction({
  args: {
    bucket: v.string(),
    object: v.string(),
    expiresSeconds: v.number(),
    method: v.union(v.literal("GET"), v.literal("PUT"), v.literal("DELETE")),
    contentType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const url = await generateGcsV4SignedUrl({
      method: args.method,
      bucket: args.bucket,
      object: args.object,
      expiresSeconds: args.expiresSeconds,
      contentType: args.contentType,
    });
    return {
      url,
      bucket: args.bucket,
      object: args.object,
      expiresSeconds: args.expiresSeconds,
    };
  },
});

export const deleteGcsObjectAction = internalAction({
  args: {
    bucket: v.string(),
    object: v.string(),
  },
  handler: async (ctx, args) => {
    const resp = await storage.bucket(args.bucket).file(args.object).delete();
    if (!resp) {
      throw new Error(`Failed to delete GCS object`);
    }
    console.log("Deleted GCS object:", args.bucket, args.object);
  },
});