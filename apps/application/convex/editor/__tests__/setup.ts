/**
 * Test setup for editor module tests
 * 
 * This file contains common test utilities and mocks for the editor tests.
 */

// Mock TipTap HTML generation for testing
export const mockGenerateHTML = (content: any, extensions: any[]) => {
  // Simple mock that converts ProseMirror JSON to basic HTML
  if (!content || !content.content) {
    return '';
  }

  const convertNode = (node: any): string => {
    if (!node.type) return '';

    switch (node.type) {
      case 'doc':
        return node.content ? node.content.map(convertNode).join('') : '';
      
      case 'paragraph':
        const pContent = node.content ? node.content.map(convertNode).join('') : '';
        return `<p>${pContent}</p>`;
      
      case 'heading':
        const level = node.attrs?.level || 1;
        const hContent = node.content ? node.content.map(convertNode).join('') : '';
        return `<h${level}>${hContent}</h${level}>`;
      
      case 'text':
        return node.text || '';
      
      case 'hardBreak':
        return '<br>';
      
      case 'bulletList':
        const ulContent = node.content ? node.content.map(convertNode).join('') : '';
        return `<ul>${ulContent}</ul>`;
      
      case 'orderedList':
        const olContent = node.content ? node.content.map(convertNode).join('') : '';
        return `<ol>${olContent}</ol>`;
      
      case 'listItem':
        const liContent = node.content ? node.content.map(convertNode).join('') : '';
        return `<li>${liContent}</li>`;
      
      case 'blockquote':
        const bqContent = node.content ? node.content.map(convertNode).join('') : '';
        return `<blockquote>${bqContent}</blockquote>`;
      
      case 'codeBlock':
        const codeContent = node.content ? node.content.map(convertNode).join('') : '';
        return `<pre><code>${codeContent}</code></pre>`;
      
      default:
        // For unknown nodes, just process children
        return node.content ? node.content.map(convertNode).join('') : '';
    }
  };

  return convertNode(content);
};

// Mock ProseMirror document factory
export const createMockDocument = (content: any) => ({
  doc: {
    content: {
      size: calculateDocumentSize(content),
      toJSON: () => content,
    },
    slice: (from: number, to: number) => ({
      content: {
        toJSON: () => createSliceContent(content, from, to)
      }
    }),
    descendants: (callback: (node: any, pos: number) => boolean | void) => {
      traverseDocument(content, callback, 1);
    }
  }
});

// Helper to calculate document size
function calculateDocumentSize(content: any): number {
  if (!content || !content.content) return 2; // Empty doc has size 2

  let size = 2; // Opening and closing doc tags
  
  const calculateNodeSize = (node: any): number => {
    if (node.type === 'text') {
      return node.text ? node.text.length : 0;
    }
    
    let nodeSize = 2; // Opening and closing tags
    if (node.content) {
      nodeSize += node.content.reduce((acc: number, child: any) => acc + calculateNodeSize(child), 0);
    }
    
    return nodeSize;
  };

  if (content.content) {
    size += content.content.reduce((acc: number, node: any) => acc + calculateNodeSize(node), 0);
  }

  return size;
}

// Helper to create slice content
function createSliceContent(content: any, from: number, to: number) {
  // Simple implementation - in reality this would be more complex
  return {
    type: 'doc',
    content: content.content ? content.content.slice(0, 2) : [] // Take first 2 nodes as approximation
  };
}

// Helper to traverse document structure
function traverseDocument(content: any, callback: (node: any, pos: number) => boolean | void, startPos: number = 1) {
  if (!content || !content.content) return;

  let pos = startPos;

  const traverse = (node: any) => {
    const shouldContinue = callback(node, pos);
    
    // Calculate node size for position tracking
    let nodeSize = 1;
    if (node.type === 'text' && node.text) {
      nodeSize = node.text.length;
    } else if (node.content) {
      nodeSize = 2; // Opening and closing
      node.content.forEach((child: any) => {
        if (shouldContinue !== false) {
          traverse(child);
        }
      });
    }
    
    pos += nodeSize;
  };

  content.content.forEach(traverse);
}

// Mock escrito data factory
export const createMockEscrito = (overrides: any = {}) => ({
  _id: "test-escrito-id",
  title: "Test Escrito",
  content: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'This is test content for the escrito.'
          }
        ]
      }
    ]
  },
  caseId: "test-case-id",
  createdBy: "test-user-id",
  status: "borrador",
  prosemirrorId: "test-prosemirror-id",
  ...overrides
});

// Test data generators
export const testDocuments = {
  simple: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Simple paragraph' }
        ]
      }
    ]
  },
  
  complex: {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [
          { type: 'text', text: 'Document Title' }
        ]
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'First paragraph with some content.' }
        ]
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [
          { type: 'text', text: 'Subsection' }
        ]
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Second paragraph with more detailed content that might span multiple chunks.' }
        ]
      }
    ]
  },
  
  withChanges: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Text with ' },
          {
            type: 'inlineChange',
            attrs: { changeType: 'added' },
            content: [
              { type: 'text', text: 'added content' }
            ]
          },
          { type: 'text', text: ' and ' },
          {
            type: 'inlineChange',
            attrs: { changeType: 'deleted' },
            content: [
              { type: 'text', text: 'deleted content' }
            ]
          },
          { type: 'text', text: ' mixed together.' }
        ]
      }
    ]
  },
  
  empty: {
    type: 'doc',
    content: []
  }
};

export default {
  mockGenerateHTML,
  createMockDocument,
  createMockEscrito,
  testDocuments
};
