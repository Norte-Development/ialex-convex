"use node";

/**
 * Firebase Helper Actions
 * 
 * This file contains all Firebase/Firestore operations as internalActions.
 * It has "use node" because it imports firebase-admin.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { getFirestore } from "../firebaseAdmin";
import { FIRESTORE_COLLECTIONS } from "./constants";

export const getAllFirestoreUsers = internalAction({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      data: v.any(),
    })
  ),
  handler: async () => {
    const firestore = getFirestore();
    const snapshot = await firestore.collection(FIRESTORE_COLLECTIONS.USERS).get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data(),
    }));
  },
});

export const getFirestoreUsersByLimit = internalAction({
  args: { limit: v.number() },
  returns: v.array(
    v.object({
      id: v.string(),
      data: v.any(),
    })
  ),
  handler: async (ctx, { limit }) => {
    const firestore = getFirestore();
    const snapshot = await firestore
      .collection(FIRESTORE_COLLECTIONS.USERS)
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data(),
    }));
  },
});

export const getFirestoreUserByEmail = internalAction({
  args: { email: v.string() },
  returns: v.union(
    v.object({
      id: v.string(),
      data: v.any(),
    }),
    v.null()
  ),
  handler: async (ctx, { email }) => {
    const firestore = getFirestore();
    const snapshot = await firestore
      .collection(FIRESTORE_COLLECTIONS.USERS)
      .where("email", "==", email)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    return {
      id: snapshot.docs[0].id,
      data: snapshot.docs[0].data(),
    };
  },
});

