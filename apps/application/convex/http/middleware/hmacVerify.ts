// HMAC verification using Web Crypto API (available in HTTP actions)
export async function verifyHmac(message: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = new Uint8Array(signature.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const messageBuffer = encoder.encode(message);

    const expectedSignature = await crypto.subtle.sign("HMAC", key, messageBuffer);
    const expectedSignatureHex = Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return signature === expectedSignatureHex;
  } catch (error) {
    console.error("HMAC verification failed:", error);
    return false;
  }
}