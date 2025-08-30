import { CHANGE_TYPES, INLINE_NODE_TYPES, BLOCK_NODE_TYPES, type ChangeType } from './types';

/**
 * Checks if a node is a complex structure that shouldn't be wrapped in change nodes
 * @param node - The node to check
 * @returns True if the node is a complex structure
 */
function isComplexStructure(node: any): boolean {
  // List structures are complex and create schema violations when wrapped
  if (node.type === 'orderedList' || node.type === 'bulletList') {
    return true;
  }
  
  // Nodes that contain list structures are also complex
  if (node.content && Array.isArray(node.content)) {
    return node.content.some((child: any) => 
      child.type === 'orderedList' || child.type === 'bulletList'
    );
  }
  
  return false;
}

/**
 * Ensures a node has proper schema compliance
 * @param node - The node to fix
 * @returns Fixed node
 */
function ensureSchemaCompliance(node: any): any {
  if (!node || typeof node !== 'object') {
    return node;
  }
  
  // Fix empty paragraph nodes
  if (node.type === 'paragraph' && !node.content) {
    return {
      ...node,
      content: []
    };
  }
  
  // Recursively fix nested content
  if (node.content && Array.isArray(node.content)) {
    return {
      ...node,
      content: node.content.map(ensureSchemaCompliance)
    };
  }
  
  return node;
}

/**
 * Creates a change node for tracking additions and deletions
 * @param content - The content to wrap in a change node
 * @param changeType - Type of change (added/deleted)
 * @param changeId - Unique change ID
 * @param semanticType - Semantic type of the change (optional)
 * @param description - Human-readable description (optional)
 * @returns Change node wrapping the content or the content itself if it's complex
 */
export function createChangeNode(
    content: any, 
    changeType: ChangeType, 
    changeId: string, 
    semanticType?: string, 
    description?: string
  ): any {
  
    // Ensure schema compliance first
    const fixedContent = ensureSchemaCompliance(content);
    
    if (isEmptyParagraph(fixedContent)) {
      return fixedContent;
    }
    
    // Don't wrap complex structures (lists) in change nodes as they cause schema violations
    if (isComplexStructure(fixedContent)) {
      console.warn(`Avoiding wrapping complex structure ${fixedContent.type} in change node to prevent schema violations`);
      
      // For complex structures, try to apply changes at a more granular level
      if (fixedContent.type === 'orderedList' || fixedContent.type === 'bulletList') {
        // Mark the list items individually instead of wrapping the entire list
        const modifiedList = { ...fixedContent };
        if (modifiedList.content && Array.isArray(modifiedList.content)) {
          modifiedList.content = modifiedList.content.map((listItem: any) => {
            if (listItem.type === 'listItem') {
              return createChangeNode(listItem, changeType, changeId, semanticType, description);
            }
            return listItem;
          });
        }
        return modifiedList;
      }
      
      // For other complex structures, return as-is to avoid schema violations
      return fixedContent;
    }

    // Special handling for listItem nodes to avoid schema violations
    // orderedList and bulletList can only contain listItem as direct children
    if (fixedContent.type === 'listItem') {
      // Instead of wrapping the entire listItem in blockChange,
      // wrap the content inside the listItem
      const modifiedListItem = { ...fixedContent };
      
      if (fixedContent.content && fixedContent.content.length > 0) {
        // Wrap each content item in the listItem with change nodes
        modifiedListItem.content = fixedContent.content.map((item: any) => {
          // Avoid recursively wrapping complex structures
          if (isComplexStructure(item)) {
            return item;
          }
          return createChangeNode(item, changeType, changeId, semanticType, description);
        });
      } else {
        // If listItem has no content, add a placeholder paragraph with change indication
        modifiedListItem.content = [{
          type: 'paragraph',
          content: [{
            type: 'inlineChange',
            attrs: { 
              changeType, 
              changeId,
              semanticType: semanticType || 'content',
              description: description || 'Empty list item change'
            },
            content: [{
              type: 'text',
              text: ''
            }]
          }]
        }];
      }
      
      return modifiedListItem;
    }

    // For inline content, create an inline change node
    if (fixedContent.type === 'text' || isInlineContent(fixedContent)) {
      return {
        type: 'inlineChange',
        attrs: { 
          changeType, 
          changeId,
          semanticType: semanticType || 'content',
          description
        },
        content: [fixedContent]
      };
    }
    
    // For simple block content (not complex structures), create a block change node
    if (isBlockContent(fixedContent)) {
      return {
        type: 'blockChange',
        attrs: { 
          changeType, 
          changeId,
          semanticType: semanticType || 'block_change',
          description
        },
        content: [fixedContent]
      };
    }
    
    // For other content types, return as-is
    return fixedContent;
  }
  

/**
 * Checks if a node represents inline content
 * @param node - The node to check
 * @returns True if the node is inline content
 */
export function isInlineContent(node: any): boolean {
    return INLINE_NODE_TYPES.includes(node.type);
  }
  
  /**
   * Checks if a node represents block-level content
   * @param node - The node to check
   * @returns True if the node is block content
   */
  export function isBlockContent(node: any): boolean {
    return BLOCK_NODE_TYPES.includes(node.type);
  }

/**
 * Checks if a paragraph is empty (represents just a newline)
 * @param node - The node to check
 * @returns True if the node is an empty paragraph
 */
export function isEmptyParagraph(node: any): boolean {
    return node.type === 'paragraph' && (!node.content || node.content.length === 0);
}

/**
 * Converts deletion metadata to visual change nodes
 * @param content - Content with potential deletion metadata
 * @returns Content with deletion metadata converted to visual change nodes
 */
export function convertMetadataToVisualChanges(content: any): any {
    if (!content || typeof content !== 'object') {
      return content;
    }
    
    // Handle arrays
    if (Array.isArray(content)) {
      return content.map(item => convertMetadataToVisualChanges(item));
    }
    
    // Handle objects (potentially nodes)
    const result = { ...content };
    
    // Process deletion metadata
    if (result.__deleted_content && result.__deleted_content.deletedItems) {
      const deletedItems = result.__deleted_content.deletedItems;
      
      // Convert deleted items to visual change nodes
      const deletionChangeNodes = deletedItems.map((deletedItem: any) => {
        return createChangeNode(
          deletedItem.item,
          CHANGE_TYPES.DELETED,
          deletedItem.changeId,
          'content_deletion',
          'Content deleted from paragraph'
        );
      });
      
      // Add deletion change nodes to content
      if (!result.content) {
        result.content = [];
      }
      result.content = [...deletionChangeNodes, ...result.content];
      
      // Remove the metadata
      delete result.__deleted_content;
    }
    
    // Recursively process nested content
    if (result.content && Array.isArray(result.content)) {
      result.content = result.content.map((item: any) => convertMetadataToVisualChanges(item));
    }
    
    // Process other nested objects
    for (const key in result) {
      if (key !== 'content' && typeof result[key] === 'object') {
        result[key] = convertMetadataToVisualChanges(result[key]);
      }
    }
    
    return result;
  }
  