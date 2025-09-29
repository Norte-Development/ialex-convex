import { describe, it, expect, beforeEach, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../_generated/api';
import schema from '../../schema';
import { modules } from '../../test.setup';
import type { Id } from '../../_generated/dataModel';

// Simple mocks that avoid complex object structures
const transformMock = vi.fn();
const generateJSONMock = vi.fn();
const generateHTMLMock = vi.fn();
const createJsonDiffMock = vi.fn();
const buildContentWithJsonChangesMock = vi.fn();
const createProseMirrorChunksMock = vi.fn();
const buildServerSchemaMock = vi.fn();
const getServerExtensionsMock = vi.fn();
const editorStateCreateMock = vi.fn();

// Simple mock schema that doesn't create complex objects
const mockSchema = {
  nodeFromJSON: vi.fn(),
};

vi.mock('../../prosemirror', () => ({
  prosemirrorSync: {
    transform: transformMock,
  },
}));

vi.mock('../../../../packages/shared/src/tiptap/schema', () => ({
  buildServerSchema: buildServerSchemaMock,
  getServerExtensions: getServerExtensionsMock,
}));

vi.mock('@tiptap/html/server', () => ({
  generateJSON: generateJSONMock,
  generateHTML: generateHTMLMock,
}));

vi.mock('../../../../packages/shared/src/diff/jsonDiff', () => ({
  createJsonDiff: createJsonDiffMock,
  buildContentWithJsonChanges: buildContentWithJsonChangesMock,
}));

vi.mock('../utils', () => ({
  extractTextFromNode: vi.fn(),
  createProseMirrorChunks: createProseMirrorChunksMock,
}));

vi.mock('@tiptap/pm/state', () => ({
  EditorState: {
    create: editorStateCreateMock,
  },
}));

describe('editor/edit actions', () => {
  let t: ReturnType<typeof convexTest>;
  let userId: Id<'users'>;
  let caseId: Id<'cases'>;
  let escritoId: Id<'escritos'>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Simple mock implementations that return basic objects
    buildServerSchemaMock.mockReturnValue(mockSchema);
    getServerExtensionsMock.mockReturnValue([]);
    mockSchema.nodeFromJSON.mockReturnValue({
      content: { size: 10 },
      toJSON: () => ({ type: 'doc', content: [] }),
    });

    generateJSONMock.mockReturnValue({ type: 'doc', content: [] });
    generateHTMLMock.mockReturnValue('Original content');

    createJsonDiffMock.mockReturnValue({});
    buildContentWithJsonChangesMock.mockReturnValue({ type: 'doc', content: [] });

    createProseMirrorChunksMock.mockReturnValue([
      { from: 1, to: 10, text: 'chunk' },
    ]);

    // Simple transaction mock with required methods
    const simpleTransaction = {
      doc: { 
        content: { size: 10 },
        toJSON: vi.fn().mockReturnValue({ type: 'doc', content: [] })
      },
      insert: vi.fn().mockReturnThis(),
      replaceWith: vi.fn().mockReturnThis(),
    };
    editorStateCreateMock.mockReturnValue({
      doc: { 
        content: { size: 10 },
        toJSON: vi.fn().mockReturnValue({ type: 'doc', content: [] })
      },
      tr: simpleTransaction,
    });

    // Simple transform mock that doesn't create complex objects
    transformMock.mockImplementation(async (_ctx, _id, _schema, fn) => {
      const simpleDoc = {
        content: { size: 10 },
        toJSON: () => ({ type: 'doc', content: [] }),
        slice: () => ({ content: { toJSON: () => ({ type: 'doc', content: [] }) } }),
      };
      await fn(simpleDoc);
      return simpleTransaction;
    });

    t = convexTest(schema, modules);

    userId = await t.run(async (ctx) => {
      return ctx.db.insert('users', {
        clerkId: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        isActive: true,
        isOnboardingComplete: true,
      });
    });

    caseId = await t.run(async (ctx) => {
      return ctx.db.insert('cases', {
        title: 'Edit Action Case',
        status: 'pendiente',
        priority: 'medium',
        startDate: Date.now(),
        assignedLawyer: userId,
        createdBy: userId,
        isArchived: false,
      });
    });

    escritoId = await t.run(async (ctx) => {
      return ctx.db.insert('escritos', {
        title: 'Editable Escrito',
        prosemirrorId: 'pm-doc-test',
        caseId,
        status: 'borrador',
        lastEditedAt: Date.now(),
        createdBy: userId,
        lastModifiedBy: userId,
        isArchived: false,
      });
    });
  });

  it('inserts HTML into a document via insertHtmlAction', async () => {
    const result = await t.action(api.editor.edit.insertHtmlAction, {
      escritoId,
      html: '<p>New content</p>',
      position: 'documentEnd',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('documentEnd');
    expect(transformMock).toHaveBeenCalled();
    expect(generateJSONMock).toHaveBeenCalled();
  });

  it('throws when insertHtmlAction receives unknown escritoId', async () => {
    const orphanEscritoId = await t.run(async (ctx) => {
      return ctx.db.insert('escritos', {
        title: 'Orphan',
        prosemirrorId: 'pm-orphan',
        caseId,
        status: 'borrador',
        lastEditedAt: Date.now(),
        createdBy: userId,
        lastModifiedBy: userId,
        isArchived: false,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.delete(orphanEscritoId);
    });

    await expect(
      t.action(api.editor.edit.insertHtmlAction, {
        escritoId: orphanEscritoId,
        html: '<p>Should fail</p>',
        position: 'documentStart',
      }),
    ).rejects.toThrow('Escrito not found');
  });

  it('applies diffs across the whole document', async () => {
    const result = await t.action(api.editor.edit.applyHtmlDiff, {
      escritoId,
      diffs: [
        {
          delete: 'Original',
          insert: 'Updated',
        },
      ],
    });

    expect(result.scope).toBe('document');
    expect(result.applied).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.strictAborted).toBe(false);
    expect(result.unmatchedDiffIndexes).toEqual([]);
    expect(transformMock).toHaveBeenCalled();
  });

  it('applies diffs to a specific chunk when chunkIndex is provided', async () => {
    // Mock HTML generation to return content that will match our diff
    generateHTMLMock.mockReturnValue('Original chunk content');
    
    const result = await t.action(api.editor.edit.applyHtmlDiff, {
      escritoId,
      diffs: [
        {
          delete: 'Original chunk',  // This will match the HTML content
          insert: 'Updated chunk',
        },
      ],
      chunkIndex: 0,
      chunkSize: 50,
    });

    expect(result.scope).toBe('chunk');
    expect(result.chunkIndex).toBe(0);
    expect(result.applied).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.unmatchedDiffIndexes).toEqual([]);
    expect(createProseMirrorChunksMock).toHaveBeenCalled();
  });

  it('aborts in strict mode when any diff cannot be applied', async () => {
    const result = await t.action(api.editor.edit.applyHtmlDiff, {
      escritoId,
      diffs: [
        {
          delete: 'Missing',
          insert: 'Replacement',
        },
      ],
      options: {
        strict: true,
      },
    });

    expect(result.strictAborted).toBe(true);
    expect(result.applied).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.unmatchedDiffIndexes).toEqual([0]);
  });

  it('returns unmatched information when chunkIndex is invalid', async () => {
    const result = await t.action(api.editor.edit.applyHtmlDiff, {
      escritoId,
      diffs: [
        {
          delete: 'Original',
          insert: 'Updated',
        },
      ],
      chunkIndex: 3,
      chunkSize: 25,
    });

    expect(result.scope).toBe('chunk');
    expect(result.strictAborted).toBe(false);
    expect(result.applied).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.unmatchedDiffIndexes).toEqual([0]);
  });

  it('throws when applyHtmlDiff receives an unknown escritoId', async () => {
    const tempEscritoId = await t.run(async (ctx) => {
      return ctx.db.insert('escritos', {
        title: 'Temp',
        prosemirrorId: 'pm-temp',
        caseId,
        status: 'borrador',
        lastEditedAt: Date.now(),
        createdBy: userId,
        lastModifiedBy: userId,
        isArchived: false,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.delete(tempEscritoId);
    });

    await expect(
      t.action(api.editor.edit.applyHtmlDiff, {
        escritoId: tempEscritoId,
        diffs: [
          {
            delete: 'Original',
            insert: 'Updated',
          },
        ],
      }),
    ).rejects.toThrow('Escrito not found');
  });
});

