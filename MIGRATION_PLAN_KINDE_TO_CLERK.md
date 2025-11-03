# iAlex Migration Plan: Kinde → Clerk + Convex

## **System Overview**

### **Old System (Source)**
- **Auth**: Kinde
- **Database**: Firestore
- **Storage**: Firebase Storage
- **Payment**: MercadoPago (manual management)

### **New System (Target)**
- **Auth**: Clerk (already implemented)
- **Database**: Convex (real-time database)
- **Storage**: Google Cloud Storage (GCS) + Convex storage (legacy)
- **Payment**: Stripe (via @raideno/convex-stripe) + MercadoPago (manual)

---

## **Pre-Migration Checklist**

### **Before Starting Migration**

1. **Backup Current Data**
   ```bash
   # Backup Firestore
   gcloud firestore export gs://your-backup-bucket/firestore-backup-$(date +%Y%m%d)
   
   # Backup Convex (if needed)
   npx convex export --output backup-$(date +%Y%m%d).json
   ```

2. **Identify Existing Users**
   ```typescript
   // Run this to see conflicts before migration
   const conflictData = await ctx.runAction(internal.migrations.identifyExistingUsers, {});
   console.log(`Found ${conflictData.conflictCount} email conflicts`);
   ```

3. **Set Up Environment Variables**
   ```bash
   # Add to .env.local
   FIREBASE_PROJECT_ID=your-firebase-project
   FIREBASE_CLIENT_EMAIL=your-service-account-email
   FIREBASE_PRIVATE_KEY=your-private-key
   GCS_BUCKET=your-gcs-bucket
   CLERK_SECRET_KEY=your-clerk-secret
   ```

4. **Test Migration with Small Batch**
   ```typescript
   // Test with 5 users first
   const testUsers = await ctx.runAction(internal.migrations.migrateTestUsers, {
     limit: 5
   });
   ```

---

## **Phase 1: Bulk User Migration (Pre-Launch)**

### 1.0 Handle Existing Users in New Platform

**IMPORTANT**: Before starting the bulk migration, we need to handle users who are already in the new platform.

#### 1.0.1 Identify Existing Users

```typescript
// convex/migrations/identifyExistingUsers.ts
export const identifyExistingUsers = internalAction({
  args: {},
  handler: async (ctx) => {
    const firestore = getFirestore();
    
    // Get all users from Firestore (Kinde users)
    const firestoreUsers = await firestore.collection('users').get();
    const kindeEmails = new Set(firestoreUsers.docs.map(doc => doc.data().email));
    
    // Get all users from Convex (existing users)
    const convexUsers = await ctx.runQuery(api.users.getAllUsers);
    const convexEmails = new Set(convexUsers.map(user => user.email));
    
    // Find conflicts
    const conflicts = Array.from(kindeEmails).filter(email => convexEmails.has(email));
    
    console.log(`Found ${conflicts.length} email conflicts:`, conflicts);
    
    return {
      kindeUserCount: firestoreUsers.size,
      convexUserCount: convexUsers.length,
      conflicts: conflicts,
      conflictCount: conflicts.length,
    };
  },
});
```

#### 1.0.2 Handle Email Conflicts

```typescript
// convex/migrations/handleEmailConflicts.ts
export const handleEmailConflicts = internalAction({
  args: {},
  handler: async (ctx) => {
    const conflictData = await ctx.runAction(internal.migrations.identifyExistingUsers, {});
    
    for (const email of conflictData.conflicts) {
      // Get both users
      const kindeUser = await getKindeUserByEmail(email);
      const convexUser = await ctx.runQuery(api.users.getByEmail, { email });
      
      if (!kindeUser || !convexUser) continue;
      
      // Strategy: Merge data or create new account
      await handleUserConflict(ctx, kindeUser, convexUser);
    }
  },
});

async function handleUserConflict(
  ctx: ActionCtx, 
  kindeUser: any, 
  convexUser: any
) {
  // Option 1: Merge data (recommended for most cases)
  if (shouldMergeUsers(kindeUser, convexUser)) {
    await mergeUserData(ctx, kindeUser, convexUser);
  } 
  // Option 2: Create new account with different email
  else {
    await createAlternativeAccount(ctx, kindeUser, convexUser);
  }
}

async function shouldMergeUsers(kindeUser: any, convexUser: any): Promise<boolean> {
  // Merge if:
  // 1. Convex user has no data (just created)
  // 2. Kinde user has more recent activity
  // 3. Names match closely
  
  const convexUserData = await getUserDataCount(convexUser._id);
  const kindeUserData = await getKindeUserDataCount(kindeUser.id);
  
  return convexUserData.totalCount === 0 || kindeUserData.totalCount > convexUserData.totalCount;
}

async function mergeUserData(ctx: ActionCtx, kindeUser: any, convexUser: any) {
  // Add migration metadata to existing Convex user
  await ctx.runMutation(api.users.addMigrationMetadata, {
    userId: convexUser._id,
    oldKindeId: kindeUser.id,
    migrationStatus: "pending",
  });
  
  console.log(`Merged Kinde user ${kindeUser.email} with existing Convex user ${convexUser._id}`);
}

async function createAlternativeAccount(ctx: ActionCtx, kindeUser: any, convexUser: any) {
  // Create new Clerk user with modified email
  const alternativeEmail = `${kindeUser.email.split('@')[0]}+migrated@${kindeUser.email.split('@')[1]}`;
  
  const clerkUser = await clerk.users.createUser({
    emailAddress: [alternativeEmail],
    firstName: kindeUser.given_name || kindeUser.firstName,
    lastName: kindeUser.family_name || kindeUser.lastName,
    skipPasswordRequirement: true,
    publicMetadata: {
      migrationStatus: "pending",
      oldKindeId: kindeUser.id,
      originalEmail: kindeUser.email,
      conflictResolution: "alternative_email",
    },
  });
  
  // Create new Convex user
  await ctx.runMutation(api.users.createMigrationStub, {
    clerkId: clerkUser.id,
    name: `${kindeUser.given_name || kindeUser.firstName} ${kindeUser.family_name || kindeUser.lastName}`,
    email: alternativeEmail,
    isActive: true,
    isOnboardingComplete: false,
    _migration: {
      status: "pending",
      oldKindeId: kindeUser.id,
      originalEmail: kindeUser.email,
      consentGiven: false,
    },
  });
  
  console.log(`Created alternative account for ${kindeUser.email} as ${alternativeEmail}`);
}
```

#### 1.0.3 Migration Conflict Resolution UI

```typescript
// src/pages/MigrationConflictPage.tsx
export function MigrationConflictPage() {
  const conflictData = useQuery(api.migrations.getConflictData);
  const resolveConflict = useMutation(api.migrations.resolveConflict);
  
  if (!conflictData?.hasConflicts) {
    return <Navigate to="/migration/consent" />;
  }
  
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">
        Resolución de Conflicto de Cuenta
      </h1>
      
      <div className="bg-yellow-50 p-6 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">
          Ya tienes una cuenta en la nueva iAlex
        </h2>
        
        <p className="mb-4">
          Encontramos que ya tienes una cuenta con el email <strong>{conflictData.email}</strong> 
          en la nueva plataforma. Necesitamos decidir cómo manejar tus datos.
        </p>
        
        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Opción 1: Fusionar cuentas (Recomendado)</h3>
            <p className="text-sm text-gray-600 mb-2">
              Mantener tu cuenta actual y migrar los datos de la cuenta anterior.
            </p>
            <div className="text-sm">
              <p>• Cuenta actual: {conflictData.currentAccountData.casesCount} casos</p>
              <p>• Cuenta anterior: {conflictData.oldAccountData.casesCount} casos</p>
            </div>
            <Button 
              onClick={() => resolveConflict({ strategy: "merge" })}
              className="mt-2"
            >
              Fusionar Cuentas
            </Button>
          </div>
          
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Opción 2: Crear cuenta alternativa</h3>
            <p className="text-sm text-gray-600 mb-2">
              Crear una nueva cuenta con email modificado para mantener ambos conjuntos de datos separados.
            </p>
            <p className="text-sm text-gray-500">
              Nueva cuenta: {conflictData.alternativeEmail}
            </p>
            <Button 
              onClick={() => resolveConflict({ strategy: "alternative" })}
              variant="outline"
              className="mt-2"
            >
              Crear Cuenta Alternativa
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 1.1 Create All Clerk Accounts from Kinde

#### 1.1.1 Test Migration Function

```typescript
// convex/migrations/migrateTestUsers.ts
export const migrateTestUsers = internalAction({
  args: { limit: v.number() },
  handler: async (ctx, { limit }) => {
    const firestore = getFirestore();
    const firestoreUsers = await firestore
      .collection('users')
      .limit(limit)
      .get();
    
    const results = [];
    
    for (const doc of firestoreUsers.docs) {
      const firestoreUser = doc.data();
      
      try {
        // Check if user already exists
        const existingUser = await ctx.runQuery(api.users.getByEmail, { 
          email: firestoreUser.email 
        });
        
        if (existingUser) {
          results.push({
            email: firestoreUser.email,
            status: "skipped",
            reason: "User already exists",
            existingUserId: existingUser._id,
          });
          continue;
        }
        
        // Create Clerk user
        const clerkUser = await clerk.users.createUser({
          emailAddress: [firestoreUser.email],
          firstName: firestoreUser.given_name || firestoreUser.firstName,
          lastName: firestoreUser.family_name || firestoreUser.lastName,
          skipPasswordRequirement: true,
          publicMetadata: {
            migrationStatus: "pending",
            oldKindeId: firestoreUser.id,
          },
        });
        
        // Create Convex user
        const convexUserId = await ctx.runMutation(api.users.createMigrationStub, {
          clerkId: clerkUser.id,
          name: `${firestoreUser.given_name || firestoreUser.firstName} ${firestoreUser.family_name || firestoreUser.lastName}`,
          email: firestoreUser.email,
          isActive: true,
          isOnboardingComplete: false,
          _migration: {
            status: "pending",
            oldKindeId: firestoreUser.id,
            consentGiven: false,
          },
        });
        
        results.push({
          email: firestoreUser.email,
          status: "success",
          clerkId: clerkUser.id,
          convexUserId,
        });
        
      } catch (error) {
        results.push({
          email: firestoreUser.email,
          status: "error",
          error: error.message,
        });
      }
    }
    
    return results;
  },
});
```

#### 1.1.2 Full Migration Function

```typescript
// convex/migrations/bulkUserMigration.ts
export const migrateAllUsersToClerk = internalAction({
  args: {},
  handler: async (ctx) => {
    const firestore = getFirestore();
    
    // Get all users from Firestore (Kinde users)
    const firestoreUsers = await firestore.collection('users').get();
    
    console.log(`Starting migration of ${firestoreUsers.size} users`);
    
    const results = {
      total: firestoreUsers.size,
      success: 0,
      skipped: 0,
      errors: 0,
      details: [] as any[],
    };
    
    for (const doc of firestoreUsers.docs) {
      const firestoreUser = doc.data();
      
      try {
        // Check if user already exists
        const existingUser = await ctx.runQuery(api.users.getByEmail, { 
          email: firestoreUser.email 
        });
        
        if (existingUser) {
          // Add migration metadata to existing user
          await ctx.runMutation(api.users.addMigrationMetadata, {
            userId: existingUser._id,
            oldKindeId: firestoreUser.id,
            migrationStatus: "pending",
          });
          
          results.skipped++;
          results.details.push({
            email: firestoreUser.email,
            status: "merged",
            existingUserId: existingUser._id,
          });
          continue;
        }
        
        // Create Clerk user
        const clerkUser = await clerk.users.createUser({
          emailAddress: [firestoreUser.email],
          firstName: firestoreUser.given_name || firestoreUser.firstName,
          lastName: firestoreUser.family_name || firestoreUser.lastName,
          skipPasswordRequirement: true,
          publicMetadata: {
            migrationStatus: "pending",
            oldKindeId: firestoreUser.id,
          },
        });
        
        // Create minimal Convex user record
        const convexUserId = await ctx.runMutation(api.users.createMigrationStub, {
          clerkId: clerkUser.id,
          name: `${firestoreUser.given_name || firestoreUser.firstName} ${firestoreUser.family_name || firestoreUser.lastName}`,
          email: firestoreUser.email,
          isActive: true,
          isOnboardingComplete: false,
          _migration: {
            status: "pending",
            oldKindeId: firestoreUser.id,
            consentGiven: false,
          },
        });
        
        results.success++;
        results.details.push({
          email: firestoreUser.email,
          status: "created",
          clerkId: clerkUser.id,
          convexUserId,
        });
        
        console.log(`Migrated user: ${firestoreUser.email}`);
        
      } catch (error) {
        results.errors++;
        results.details.push({
          email: firestoreUser.email,
          status: "error",
          error: error.message,
        });
        console.error(`Failed to migrate user ${firestoreUser.email}:`, error);
      }
    }
    
    console.log(`Migration completed:`, results);
    return results;
  },
});
```

#### 1.1.3 Helper Functions

```typescript
// convex/migrations/helpers.ts
export const getUserDataCount = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const cases = await ctx.db
      .query("cases")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .collect();
    
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .collect();
    
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .collect();
    
    return {
      casesCount: cases.length,
      documentsCount: documents.length,
      clientsCount: clients.length,
      totalCount: cases.length + documents.length + clients.length,
    };
  },
});

export const addMigrationMetadata = mutation({
  args: {
    userId: v.id("users"),
    oldKindeId: v.string(),
    migrationStatus: v.string(),
  },
  handler: async (ctx, { userId, oldKindeId, migrationStatus }) => {
    await ctx.db.patch(userId, {
      _migration: {
        status: migrationStatus as any,
        oldKindeId,
        consentGiven: false,
      },
    });
  },
});

export const createMigrationStub = mutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    isActive: v.boolean(),
    isOnboardingComplete: v.boolean(),
    _migration: v.object({
      status: v.string(),
      oldKindeId: v.string(),
      consentGiven: v.boolean(),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      name: args.name,
      email: args.email,
      isActive: args.isActive,
      isOnboardingComplete: args.isOnboardingComplete,
      _migration: args._migration as any,
    });
    
    return userId;
  },
});
```

### 1.2 Send Migration Announcement

```typescript
// convex/migrations/sendAnnouncement.ts
export const sendMigrationAnnouncement = internalAction({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.runQuery(api.users.getAllUsers);
    
    for (const user of users) {
      if (user._migration?.status === "pending") {
        await sendEmail({
          to: user.email,
          subject: "¡Bienvenido a la nueva iAlex!",
          template: "migration-announcement",
          data: {
            name: user.name,
            migrationUrl: `${process.env.FRONTEND_URL}/migration/consent`,
          },
        });
      }
    }
  },
});
```

---

## **Migration Execution Steps**

### **Step 1: Pre-Migration (Day -1)**
1. Run backup commands
2. Test with 5 users: `await ctx.runAction(internal.migrations.migrateTestUsers, { limit: 5 })`
3. Verify test results
4. Set up monitoring

### **Step 2: User Migration (Day 0)**
1. Run conflict detection: `await ctx.runAction(internal.migrations.identifyExistingUsers, {})`
2. Handle conflicts: `await ctx.runAction(internal.migrations.handleEmailConflicts, {})`
3. Migrate all users: `await ctx.runAction(internal.migrations.migrateAllUsersToClerk, {})`
4. Send announcement: `await ctx.runAction(internal.migrations.sendMigrationAnnouncement, {})`

### **Step 3: Monitor Migration (Day 1+)**
1. Monitor user logins and migration progress
2. Handle failed migrations
3. Support users with issues
4. Update MercadoPago subscriptions manually

---

## **Key Benefits of This Approach**

1. **Handles Existing Users**: Automatically detects and resolves conflicts
2. **User Control**: Users can opt-in or start fresh
3. **No Downtime**: Old Kinde app stays online during migration
4. **Gradual Load**: Migrations spread across days/weeks
5. **Error Recovery**: Failed migrations can be retried per-user
6. **Progress Tracking**: Users see real-time migration status
7. **Manual MercadoPago**: Simple management for few users
8. **Smart Document Mapping**: Expediente docs → cases, others → library
9. **Admin Dashboard**: Easy MercadoPago subscription management
10. **Test-First**: Small batch testing before full migration

## **Timeline**

- **Day -1**: Pre-migration setup and testing
- **Day 0**: Deploy new app with migration code
- **Day 0**: Migrate all users to Clerk (bulk)
- **Day 0**: Send announcement emails
- **Day 1+**: Users login and trigger their own migrations
- **Week 1**: Monitor and support early adopters
- **Week 2-4**: Bulk of users migrate organically
- **Month 2**: Decommission old Kinde system

## **Admin Tasks**

1. **Pre-migration**: Set up MercadoPago user tracking
2. **During migration**: Monitor progress via Convex dashboard
3. **Post-migration**: Manage MercadoPago subscriptions manually
4. **Ongoing**: Update subscription statuses as needed

This approach gives you full control over the migration process while minimizing risk and providing a smooth user experience, with simple manual management for your few MercadoPago users and proper handling of existing users in the new platform.
