'use node'
import * as admin from "firebase-admin";

let firebaseApp: admin.app.App | null = null;

export function getFirebaseApp(): admin.app.App {
  if (firebaseApp) return firebaseApp;

  // Get credentials from environment variables
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) privateKey = privateKey.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase configuration. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
    );
  }

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    databaseURL: `https://${projectId}-default-rtdb.firebaseio.com`,
  });
  return firebaseApp;
}

export function getFirestore(): admin.firestore.Firestore {
  return getFirebaseApp().firestore();
}