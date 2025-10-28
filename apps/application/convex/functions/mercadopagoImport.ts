import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * CSV Import functions for MercadoPago subscriptions
 */

// Interface for CSV row data
interface MercadoPagoCSVRow {
  id: string; // mp_subscription_id
  payer_id: string; // mp_customer_id
  payer_first_name: string;
  payer_last_name: string;
  status: string; // authorized, cancelled
  reason: string;
  external_reference: string; // Kinde user reference
  date_created: string;
  last_modified: string;
  frequency: string; // 1, 12
  frequency_type: string; // months
  transaction_amount: string; // amount in pesos with decimal (e.g., "1500.0")
  currency_id: string; // ARS
  start_date: string;
  end_date: string;
  last_charge_date: string;
  last_charge_amount: string;
  next_payment_date: string;
  charged_quantity: string;
  pending_charge_quantity: string;
  charge_amount: string;
  pending_charge_amount: string;
}

// Parse CSV data
function parseCSV(csvContent: string): MercadoPagoCSVRow[] {
  try {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }
    
    const headers = lines[0].split(',').map(h => h.trim());
    
    return lines.slice(1).map((line, index) => {
      const values = line.split(',');
      const row: any = {};
      
      headers.forEach((header, headerIndex) => {
        row[header] = values[headerIndex]?.trim() || '';
      });
      
      return row as MercadoPagoCSVRow;
    });
  } catch (error) {
    console.error('Error parsing CSV:', error);
    throw new Error(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Map CSV status to our schema status
function mapStatus(csvStatus: string): "active" | "paused" | "cancelled" | "expired" {
  switch (csvStatus.toLowerCase()) {
    case 'authorized':
      return 'active';
    case 'cancelled':
      return 'cancelled';
    case 'paused':
      return 'paused';
    default:
      return 'expired';
  }
}

// Map frequency to billing cycle
function mapBillingCycle(frequency: string, frequencyType: string): "monthly" | "yearly" {
  if (frequencyType === 'months') {
    return parseInt(frequency) === 12 ? 'yearly' : 'monthly';
  }
  return 'monthly';
}

// Parse date string to timestamp
function parseDate(dateStr: string): number {
  if (!dateStr || dateStr.trim() === '') return Date.now();
  
  try {
    // Handle format: 2025-08-12 19:49:55
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date string: ${dateStr}, using current time`);
      return Date.now();
    }
    return date.getTime();
  } catch (error) {
    console.warn(`Error parsing date: ${dateStr}, using current time`);
    return Date.now();
  }
}

// Find user by kindeId (externalReference) or email, or create a placeholder
async function findOrCreateUser(ctx: any, email: string, name: string, externalReference?: string): Promise<Id<"users"> | null> {
  // First, try to find user by externalReference (kindeId) if provided
  if (externalReference) {
    const userByKindeId = await ctx.db
      .query("users")
      .filter((q: any) => q.eq(q.field("migration.oldKindeId"), externalReference))
      .first();
    
    if (userByKindeId) {
      console.log(`Found user by kindeId ${externalReference}: ${userByKindeId.email}`);
      return userByKindeId._id;
    }
  }

  // Fallback: try to find existing user by email
  const existingUser = await ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", email))
    .first();
  
  if (existingUser) {
    console.log(`Found user by email ${email}: ${existingUser.email}`);
    return existingUser._id;
  }
  
  // If no user found, return null - we'll handle creation in the import logic
  console.log(`No user found for email ${email} or kindeId ${externalReference}`);
  return null;
}

// Bulk import MercadoPago subscriptions from CSV
export const importMercadoPagoCSV = mutation({
  args: {
    csvContent: v.string(),
    adminUserId: v.id("users"),
  },
  handler: async (ctx, { csvContent, adminUserId }) => {
    try {
      // Validate admin user exists
      const adminUser = await ctx.db.get(adminUserId);
      if (!adminUser) {
        throw new Error(`Admin user with ID ${adminUserId} not found`);
      }

      const rows = parseCSV(csvContent);
      const results = {
        total: rows.length,
        imported: 0,
        skipped: 0,
        errors: 0,
        details: [] as any[],
      };

    for (const row of rows) {
      try {
        // Skip empty rows
        if (!row.id || !row.payer_id || !row.payer_first_name || !row.payer_last_name) {
          results.skipped++;
          results.details.push({
            row: row,
            status: "skipped",
            reason: "Missing required fields (id, payer_id, payer_first_name, payer_last_name)",
          });
          continue;
        }

        // Validate transaction amount
        const amount = parseFloat(row.transaction_amount);
        if (isNaN(amount) || amount <= 0) {
          results.skipped++;
          results.details.push({
            row: row,
            status: "skipped",
            reason: "Invalid transaction amount",
          });
          continue;
        }

        // Check if subscription already exists
        const existingSubscription = await ctx.db
          .query("mercadopagoSubscriptions")
          .withIndex("by_mp_subscription_id", (q) => q.eq("mpSubscriptionId", row.id))
          .first();

        if (existingSubscription) {
          results.skipped++;
          results.details.push({
            row: row,
            status: "skipped",
            reason: "Subscription already exists",
            subscriptionId: existingSubscription._id,
          });
          continue;
        }

        // Try to find user by externalReference (kindeId) first, then by email
        const email = `${row.payer_first_name.toLowerCase()}.${row.payer_last_name.toLowerCase()}@mercadopago.placeholder`;
        const userId = await findOrCreateUser(ctx, email, `${row.payer_first_name} ${row.payer_last_name}`, row.external_reference);

        if (!userId) {
          results.skipped++;
          results.details.push({
            row: row,
            status: "skipped",
            reason: `User not found for kindeId ${row.external_reference} or email ${email}`,
          });
          continue;
        }

        // Create subscription
        const subscriptionId = await ctx.db.insert("mercadopagoSubscriptions", {
          userId: userId,
          mpSubscriptionId: row.id,
          mpCustomerId: row.payer_id,
          plan: "premium_individual", // Default to individual plan
          status: mapStatus(row.status),
          amount: Math.round(parseFloat(row.transaction_amount) * 100) || 0, // Convert pesos to cents
          currency: row.currency_id || "ARS",
          billingCycle: mapBillingCycle(row.frequency, row.frequency_type),
          startDate: parseDate(row.start_date || row.date_created),
          nextBillingDate: parseDate(row.next_payment_date),
          endDate: row.status === 'cancelled' ? parseDate(row.end_date || row.last_modified) : undefined,
          lastUpdatedBy: adminUserId,
          notes: `Imported from CSV - External Ref: ${row.external_reference}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        results.imported++;
        results.details.push({
          row: row,
          status: "imported",
          subscriptionId: subscriptionId,
          userId: userId,
        });

      } catch (error) {
        results.errors++;
        results.details.push({
          row: row,
          status: "error",
          error: (error as Error).message,
        });
      }
    }

    return results;
    } catch (error) {
      console.error('Error in importMercadoPagoCSV:', error);
      throw new Error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

// Create placeholder users for CSV import
export const createPlaceholderUsers = mutation({
  args: {
    csvContent: v.string(),
  },
  handler: async (ctx, { csvContent }) => {
    const rows = parseCSV(csvContent);
    const results = {
      total: rows.length,
      created: 0,
      skipped: 0,
      errors: 0,
      details: [] as any[],
    };

    for (const row of rows) {
      try {
        if (!row.payer_first_name || !row.payer_last_name) {
          results.skipped++;
          continue;
        }

        const email = `${row.payer_first_name.toLowerCase()}.${row.payer_last_name.toLowerCase()}@mercadopago.placeholder`;
        const name = `${row.payer_first_name} ${row.payer_last_name}`;

        // Check if user already exists
        const existingUser = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", email))
          .first();

        if (existingUser) {
          results.skipped++;
          results.details.push({
            name: name,
            email: email,
            status: "skipped",
            reason: "User already exists",
            userId: existingUser._id,
          });
          continue;
        }

        // Create placeholder user with proper kindeId reference
        const userId = await ctx.db.insert("users", {
          clerkId: `mp_placeholder_${row.payer_id}`,
          name: name,
          email: email,
          isActive: true,
          isOnboardingComplete: false,
          role: "basic",
          migration: {
            status: "pending",
            oldKindeId: row.external_reference || `mp_${row.payer_id}`,
            consentGiven: false,
          },
        });

        results.created++;
        results.details.push({
          name: name,
          email: email,
          status: "created",
          userId: userId,
        });

      } catch (error) {
        results.errors++;
        results.details.push({
          row: row,
          status: "error",
          error: (error as Error).message,
        });
      }
    }

    return results;
  },
});

// Get import preview (parse CSV without importing)
export const getImportPreview = mutation({
  args: {
    csvContent: v.string(),
  },
  handler: async (ctx, { csvContent }) => {
    try {
      const rows = parseCSV(csvContent);
      
      const preview = await Promise.all(rows.map(async (row, index) => {
        const email = `${row.payer_first_name.toLowerCase()}.${row.payer_last_name.toLowerCase()}@mercadopago.placeholder`;
        const name = `${row.payer_first_name} ${row.payer_last_name}`;
        
        // Check if user exists by kindeId or email
        let userMatch: { type: "kindeId" | "email"; email: string; name: string } | null = null;
        if (row.external_reference) {
          const userByKindeId = await ctx.db
            .query("users")
            .filter((q) => q.eq(q.field("migration.oldKindeId"), row.external_reference))
            .first();
          if (userByKindeId) {
            userMatch = { type: "kindeId" as const, email: userByKindeId.email, name: userByKindeId.name };
          }
        }
        
        if (!userMatch) {
          const userByEmail = await ctx.db
            .query("users")
            .withIndex("by_email", (q: any) => q.eq("email", email))
            .first();
          if (userByEmail) {
            userMatch = { type: "email" as const, email: userByEmail.email, name: userByEmail.name };
          }
        }
        
        return {
          index: index + 1,
          name: name,
          email: email,
          mpSubscriptionId: row.id,
          mpCustomerId: row.payer_id,
          status: mapStatus(row.status),
          amount: Math.round(parseFloat(row.transaction_amount) * 100) || 0, // Convert pesos to cents
          currency: row.currency_id || "ARS",
          billingCycle: mapBillingCycle(row.frequency, row.frequency_type),
          startDate: row.start_date || row.date_created,
          nextPaymentDate: row.next_payment_date,
          externalReference: row.external_reference,
          userMatch: userMatch,
        };
      }));

      return {
        total: preview.length,
        preview: preview,
      };
    } catch (error) {
      console.error('Error in getImportPreview:', error);
      throw new Error(`Preview failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

// Debug function to test CSV parsing
export const debugCSVParsing = mutation({
  args: {
    csvContent: v.string(),
  },
  handler: async (ctx, { csvContent }) => {
    try {
      const lines = csvContent.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      return {
        success: true,
        lineCount: lines.length,
        headers: headers,
        firstRow: lines[1] ? lines[1].split(',') : null,
        sampleParsed: lines.length > 1 ? (() => {
          const values = lines[1].split(',');
          const row: any = {};
          headers.forEach((header, headerIndex) => {
            row[header] = values[headerIndex]?.trim() || '';
          });
          return row;
        })() : null,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});
