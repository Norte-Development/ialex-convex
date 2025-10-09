import { describe, it, expect, beforeEach } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../_generated/api';
import schema from '../../../schema';
import { modules } from '../../helpers/test.setup';

describe('applyTextBasedOperations integration', () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it('can create and retrieve escritos data', async () => {
    // Test basic database operations for escritos
    const escritoId = await t.run(async (ctx) => {
      // Create a user first
      const userId = await ctx.db.insert("users", {
        clerkId: "test-clerk-id",
        name: "Test User",
        email: "test@example.com",
        isActive: true,
        isOnboardingComplete: true,
      });

      // Create a case
      const caseId = await ctx.db.insert("cases", {
        title: "Test Case",
        status: "pendiente",
        priority: "medium",
        startDate: Date.now(),
        assignedLawyer: userId,
        createdBy: userId,
        isArchived: false,
      });

      // Create an escrito with test content
      return await ctx.db.insert("escritos", {
        title: "Test Escrito",
        prosemirrorId: JSON.stringify({
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'A\u00A0B\u00ADC' }] },
          ],
        }),
        caseId,
        status: "borrador",
        lastEditedAt: Date.now(),
        createdBy: userId,
        lastModifiedBy: userId,
        isArchived: false,
      });
    });

    // Verify the escrito was created
    const escrito = await t.run(async (ctx) => {
      return await ctx.db.get(escritoId);
    });

    expect(escrito).toBeTruthy();
    expect(escrito!.title).toBe("Test Escrito");
    expect(escrito!.status).toBe("borrador");
    
    // Verify the prosemirror content
    const content = JSON.parse(escrito!.prosemirrorId);
    expect(content.type).toBe('doc');
    expect(content.content).toHaveLength(1);
    expect(content.content[0].type).toBe('paragraph');
  });

  it('can update escrito status', async () => {
    // Test updating escrito data
    const escritoId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "test-clerk-id-2",
        name: "Test User 2",
        email: "test2@example.com",
        isActive: true,
        isOnboardingComplete: true,
      });

      const caseId = await ctx.db.insert("cases", {
        title: "Test Case 2",
        status: "pendiente",
        priority: "medium",
        startDate: Date.now(),
        assignedLawyer: userId,
        createdBy: userId,
        isArchived: false,
      });

      return await ctx.db.insert("escritos", {
        title: "Test Escrito 2",
        prosemirrorId: JSON.stringify({
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Hello World' }] },
          ],
        }),
        caseId,
        status: "borrador",
        lastEditedAt: Date.now(),
        createdBy: userId,
        lastModifiedBy: userId,
        isArchived: false,
      });
    });

    // Update the escrito status
    await t.run(async (ctx) => {
      await ctx.db.patch(escritoId, {
        status: "terminado",
        lastEditedAt: Date.now(),
      });
    });

    // Verify the update
    const updatedEscrito = await t.run(async (ctx) => {
      return await ctx.db.get(escritoId);
    });

    expect(updatedEscrito).toBeTruthy();
    expect(updatedEscrito!.status).toBe("terminado");
  });
});


