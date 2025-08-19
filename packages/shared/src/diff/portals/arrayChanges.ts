import { CHANGE_TYPES } from '../types';
import { createChangeNode } from './nodeChanges';
import { createTextDiff, handleTextDelta } from './textDiff';
import { normalizeText } from '../utils';
import { detectFormattingChanges, createFormattingDiff } from './formattingChanges';
import { applyJsonDelta } from './deltaUtils';

function normalizeTextForComparison(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function extractNormalizedText(node: any): string {
  if (!node) return '';
  if (node.type === 'text') {
    return normalizeTextForComparison(node.text || '');
  }
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractNormalizedText).join('');
  }
  return '';
}

function areNodesContentEquivalent(node1: any, node2: any): boolean {
  if (!node1 || !node2) return false;
  if (node1.type !== node2.type) return false;
  if (node1.type === 'text') {
    const text1 = normalizeTextForComparison(node1.text || '');
    const text2 = normalizeTextForComparison(node2.text || '');
    const marks1 = JSON.stringify(node1.marks || []);
    const marks2 = JSON.stringify(node2.marks || []);
    return text1 === text2 && marks1 === marks2;
  }
  if (node1.type === 'paragraph' || node1.type === 'heading' || node1.type === 'blockquote') {
    const text1 = extractNormalizedText(node1);
    const text2 = extractNormalizedText(node2);
    if (text1 !== text2) return false;
    const attrs1 = JSON.stringify(node1.attrs || {});
    const attrs2 = JSON.stringify(node2.attrs || {});
    if (attrs1 !== attrs2) return false;
    return true;
  }
  const attrs1 = JSON.stringify(node1.attrs || {});
  const attrs2 = JSON.stringify(node2.attrs || {});
  if (attrs1 !== attrs2) return false;
  if (node1.content || node2.content) {
    const content1 = node1.content || [];
    const content2 = node2.content || [];
    if (content1.length !== content2.length) return false;
    for (let i = 0; i < content1.length; i++) {
      if (!areNodesContentEquivalent(content1[i], content2[i])) {
        return false;
      }
    }
  }
  return true;
}

function isParagraphTextModification(oldParagraph: any, newParagraph: any): boolean {
  if (!oldParagraph || !newParagraph) return false;
  if (oldParagraph.type !== 'paragraph' || newParagraph.type !== 'paragraph') return false;
  const oldAttrs = JSON.stringify(oldParagraph.attrs || {});
  const newAttrs = JSON.stringify(newParagraph.attrs || {});
  if (oldAttrs !== newAttrs) return false;
  const oldContent = oldParagraph.content || [];
  const newContent = newParagraph.content || [];
  if (oldContent.length !== newContent.length) return false;
  let hasTextChange = false;
  for (let i = 0; i < oldContent.length; i++) {
    const oldNode = oldContent[i];
    const newNode = newContent[i];
    if (oldNode.type !== newNode.type) return false;
    if (oldNode.type === 'text') {
      const oldMarks = JSON.stringify(oldNode.marks || []);
      const newMarks = JSON.stringify(newNode.marks || []);
      if (oldMarks !== newMarks) return false;
      if (oldNode.text !== newNode.text) {
        hasTextChange = true;
      }
    } else {
      if (JSON.stringify(oldNode) !== JSON.stringify(newNode)) return false;
    }
  }
  return hasTextChange;
}

function createParagraphTextChanges(oldParagraph: any, newParagraph: any, changeId: string): any[] {
  const result: any[] = [];
  const oldContent = oldParagraph.content || [];
  const newContent = newParagraph.content || [];
  for (let i = 0; i < Math.max(oldContent.length, newContent.length); i++) {
    const oldNode = oldContent[i];
    const newNode = newContent[i];
    if (oldNode && newNode && 
        oldNode.type === 'text' && newNode.type === 'text' && 
        oldNode.text !== newNode.text) {
      const deletedNode = {
        type: 'inlineChange',
        attrs: {
          changeType: 'deleted',
          changeId: changeId,
          semanticType: 'text_change'
        },
        content: [
          {
            type: 'text',
            marks: oldNode.marks || [],
            text: oldNode.text
          }
        ]
      };
      const addedNode = {
        type: 'inlineChange',
        attrs: {
          changeType: 'added',
          changeId: changeId,
          semanticType: 'text_change'
        },
        content: [
          {
            type: 'text',
            marks: newNode.marks || [],
            text: newNode.text
          }
        ]
      };
      result.push(deletedNode);
      result.push(addedNode);
    } else if (oldNode && newNode) {
      result.push(newNode);
    } else if (newNode) {
      result.push(newNode);
    }
  }
  if (result.length === 0) {
    return [newParagraph];
  }
  return [{
    type: 'paragraph',
    attrs: newParagraph.attrs || {},
    content: result
  }];
}

function getSearchWindow(totalLength: number, changeIndex: number): {start: number, end: number} {
  const windowSize = Math.min(Math.max(20, Math.floor(totalLength * 0.1)), 50);
  const start = Math.max(0, changeIndex - windowSize);
  const end = Math.min(totalLength, changeIndex + windowSize);
  return { start, end };
}

function getMoveScore(fromIndex: number, toIndex: number, totalChanges: number): number {
  const distance = Math.abs(toIndex - fromIndex);
  let proximityScore = Math.max(0, 100 - distance * 2);
  if (totalChanges > 10) {
    proximityScore *= 1.5;
  }
  if (distance === 0) {
    proximityScore += 50;
  }
  return Math.min(100, proximityScore);
}

function filterFalsePositiveChanges(
  additions: Map<number, any>, 
  deletions: Map<number, any>
): {
  filteredAdditions: Map<number, any>,
  filteredDeletions: Map<number, any>,
  detectedMoves: Array<{fromIndex: number, toIndex: number, content: any, score: number}>
} {
  const filteredAdditions = new Map(additions);
  const filteredDeletions = new Map(deletions);
  const detectedMoves: Array<{fromIndex: number, toIndex: number, content: any, score: number}> = [];
  const totalChanges = additions.size + deletions.size;
  const maxIndex = Math.max(
    ...Array.from(additions.keys()),
    ...Array.from(deletions.keys()),
    0
  );
  const potentialMoves: Array<{fromIndex: number, toIndex: number, content: any, score: number}> = [];
  for (const [deletionIndex, deletedContent] of deletions) {
    const searchWindow = getSearchWindow(maxIndex + 1, deletionIndex);
    for (const [additionIndex, addedContent] of additions) {
      if (additionIndex >= searchWindow.start && additionIndex <= searchWindow.end) {
        if (areNodesContentEquivalent(deletedContent, addedContent)) {
          const score = getMoveScore(deletionIndex, additionIndex, totalChanges);
          potentialMoves.push({
            fromIndex: deletionIndex,
            toIndex: additionIndex,
            content: deletedContent,
            score
          });
        }
      }
    }
  }
  let scoreThreshold = 40;
  if (totalChanges > 20) {
    scoreThreshold = 30;
  } else if (totalChanges > 50) {
    scoreThreshold = 20;
  }
  potentialMoves
    .sort((a, b) => b.score - a.score)
    .forEach(move => {
      if (move.score >= scoreThreshold && 
          filteredDeletions.has(move.fromIndex) && 
          filteredAdditions.has(move.toIndex)) {
        detectedMoves.push(move);
        filteredDeletions.delete(move.fromIndex);
        filteredAdditions.delete(move.toIndex);
      }
    });
  const remainingDeletions = Array.from(filteredDeletions.entries()).sort((a, b) => a[0] - b[0]);
  const remainingAdditions = Array.from(filteredAdditions.entries()).sort((a, b) => a[0] - b[0]);
  if (remainingDeletions.length > 5 && remainingAdditions.length > 5) {
    const additionalMoves: Array<{fromIndex: number, toIndex: number, content: any, score: number}> = [];
    for (let i = 0; i < remainingDeletions.length; i++) {
      const [delIndex, delContent] = remainingDeletions[i];
      for (let j = 0; j < remainingAdditions.length; j++) {
        const [addIndex, addContent] = remainingAdditions[j];
        if (areNodesContentEquivalent(delContent, addContent)) {
          const alreadyProcessed = additionalMoves.some(m => 
            m.fromIndex === delIndex || m.toIndex === addIndex);
          if (!alreadyProcessed) {
            additionalMoves.push({
              fromIndex: delIndex,
              toIndex: addIndex,
              content: delContent,
              score: 25
            });
            break;
          }
        }
      }
    }
    if (additionalMoves.length >= 3) {
      additionalMoves.forEach(move => {
        if (filteredDeletions.has(move.fromIndex) && filteredAdditions.has(move.toIndex)) {
          detectedMoves.push(move);
          filteredDeletions.delete(move.fromIndex);
          filteredAdditions.delete(move.toIndex);
        }
      });
    }
  }
  return { filteredAdditions, filteredDeletions, detectedMoves };
}

export function handleArrayDelta(
  newNode: any,
  oldNode: any,
  delta: any,
  baseChangeId: string,
  path: string[]
): void {
  const arrayKey = path[path.length - 1] || 'content';
  const newArray = newNode[arrayKey] || [];
  const oldArray = oldNode[arrayKey] || [];
  const changesByType = categorizeArrayChanges(delta, oldArray);
  const resultArray = buildArrayWithChanges(
    newArray,
    oldArray,
    changesByType,
    baseChangeId,
    path
  );
  newNode[arrayKey] = resultArray;
}

export function categorizeArrayChanges(delta: any, oldArray: any[] = []) {
  const additions = new Map<number, any>();
  const deletions = new Map<number, any>();
  const nestedChanges = new Map<number, any>();
  const formattingChanges = new Map<number, { oldContent: any[], newContent: any[] }>();
  for (const key in delta) {
    if (key === '_t') continue;
    const change = delta[key];
    if (key.startsWith('_')) {
      const index = parseInt(key.substring(1));
      if (Array.isArray(change) && change.length === 3 && change[1] === 0 && change[2] === 0) {
        deletions.set(index, change[0]);
      }
    } else {
      const index = parseInt(key);
      if (Array.isArray(change) && change.length === 1) {
        const newContent = change[0];
        const oldContent = oldArray[index];
        if (oldContent && newContent && 
            oldContent.type === 'paragraph' && newContent.type === 'paragraph' &&
            oldContent.content && newContent.content &&
            detectFormattingChanges(oldContent.content, newContent.content)) {
          formattingChanges.set(index, {
            oldContent: oldContent.content,
            newContent: newContent.content
          });
        } else {
          additions.set(index, newContent);
        }
      } else if (typeof change === 'object' && change !== null) {
        nestedChanges.set(index, change);
      }
    }
  }
  const originalAdditions = additions.size;
  const originalDeletions = deletions.size;
  const paragraphTextChangeIndices = new Set<number>();
  const paragraphTextChanges = new Map<string, { oldParagraph: any, newParagraph: any, changeId: string }>();
  for (const [deletionIndex, deletedContent] of deletions) {
    for (const [additionIndex, addedContent] of additions) {
      if (isParagraphTextModification(deletedContent, addedContent)) {
        const changeId = `paragraph-text-${Math.random().toString(36).substr(2, 9)}`;
        paragraphTextChanges.set(`${deletionIndex}-${additionIndex}`, {
          oldParagraph: deletedContent,
          newParagraph: addedContent,
          changeId
        });
        paragraphTextChangeIndices.add(deletionIndex);
        paragraphTextChangeIndices.add(additionIndex);
        deletions.delete(deletionIndex);
        additions.delete(additionIndex);
        nestedChanges.set(additionIndex, {
          __paragraphTextChange: true,
          oldParagraph: deletedContent,
          newParagraph: addedContent,
          changeId
        });
        console.log(`Detected paragraph text modification at indices ${deletionIndex}->${additionIndex}`);
        break;
      }
    }
  }
  const { filteredAdditions, filteredDeletions, detectedMoves } = filterFalsePositiveChanges(additions, deletions);
  if (detectedMoves.length > 0 || paragraphTextChanges.size > 0) {
    console.log(`Change detection improvements:`, {
      originalAdditions,
      originalDeletions,
      filteredAdditions: filteredAdditions.size,
      filteredDeletions: filteredDeletions.size,
      movesDetected: detectedMoves.length,
      paragraphTextChanges: paragraphTextChanges.size,
      moves: detectedMoves.map(move => ({
        from: move.fromIndex,
        to: move.toIndex,
        score: move.score,
        type: move.content.type
      }))
    });
  }
  additions.clear();
  deletions.clear();
  filteredAdditions.forEach((value, key) => {
    if (!paragraphTextChangeIndices.has(key)) {
      additions.set(key, value);
    }
  });
  filteredDeletions.forEach((value, key) => {
    if (!paragraphTextChangeIndices.has(key)) {
      deletions.set(key, value);
    }
  });
  for (const [deletionIndex, deletedItem] of deletions) {
    if (deletedItem.type === 'text' && deletedItem.text) {
      const consecutiveAdditions = [];
      let currentIndex = deletionIndex;
      while (additions.has(currentIndex)) {
        const addedItem = additions.get(currentIndex);
        if (addedItem && addedItem.type === 'text') {
          consecutiveAdditions.push(addedItem);
          currentIndex++;
        } else {
          break;
        }
      }
      if (consecutiveAdditions.length > 1) {
        const originalText = deletedItem.text;
        const combinedNewText = consecutiveAdditions.map(item => item.text || '').join('');
        if (normalizeText(originalText) === normalizeText(combinedNewText)) {
          const oldContent = [deletedItem];
          const newContent = consecutiveAdditions;
          formattingChanges.set(deletionIndex, {
            oldContent,
            newContent
          });
          deletions.delete(deletionIndex);
          for (let i = deletionIndex; i < deletionIndex + consecutiveAdditions.length; i++) {
            additions.delete(i);
          }
        }
      }
    }
  }
  return { additions, deletions, nestedChanges, formattingChanges };
}

export function buildArrayWithChanges(
  newArray: any[],
  oldArray: any[],
  changesByType: {
    additions: Map<number, any>,
    deletions: Map<number, any>,
    nestedChanges: Map<number, any>,
    formattingChanges: Map<number, { oldContent: any[], newContent: any[] }>
  },
  baseChangeId: string,
  path: string[]
): any[] {
  const { additions, deletions, nestedChanges, formattingChanges } = changesByType;
  const resultArray: any[] = [];
  const processedIndices = new Set<number>();
  for (let i = 0; i < newArray.length; i++) {
    if (processedIndices.has(i)) {
      continue;
    }
    const addition = additions.get(i);
    const deletion = deletions.get(i);
    const nestedChange = nestedChanges.get(i);
    const formattingChange = formattingChanges.get(i);
    if (formattingChange) {
      const changeId = `${baseChangeId}-format-${i}`;
      const formattingDiff = createFormattingDiff(
        formattingChange.oldContent,
        formattingChange.newContent,
        changeId
      );
      resultArray.push(...formattingDiff);
      const numNodes = formattingChange.newContent.length;
      for (let j = i; j < i + numNodes; j++) {
        processedIndices.add(j);
      }
    } else if (nestedChange) {
      const processedItem = processNestedArrayChange(
        newArray[i],
        oldArray[i],
        nestedChange,
        baseChangeId,
        path,
        i
      );
      if (processedItem) {
        if (Array.isArray(processedItem)) {
          resultArray.push(...processedItem);
        } else {
          resultArray.push(processedItem);
        }
      }
    } else if (addition && deletion) {
      const changeId = `${baseChangeId}-replace-${i}`;
      if (deletion.type === 'text' && addition.type === 'text' && 
          deletion.text && addition.text &&
          (deletion.text.length >= 60 || addition.text.length >= 60)) {
        const textDiff = createTextDiff(deletion.text, addition.text, changeId);
        if (textDiff && textDiff.length > 1) {
          resultArray.push(...textDiff);
        } else {
          resultArray.push(createChangeNode(deletion, CHANGE_TYPES.DELETED, changeId));
          resultArray.push(createChangeNode(addition, CHANGE_TYPES.ADDED, changeId));
        }
      } else {
        resultArray.push(createChangeNode(deletion, CHANGE_TYPES.DELETED, changeId));
        resultArray.push(createChangeNode(addition, CHANGE_TYPES.ADDED, changeId));
      }
    } else if (addition) {
      const changeId = `${baseChangeId}-add-${i}`;
      resultArray.push(createChangeNode(addition, CHANGE_TYPES.ADDED, changeId));
    } else if (deletion && !newArray[i]) {
      const changeId = `${baseChangeId}-del-${i}`;
      resultArray.push(createChangeNode(deletion, CHANGE_TYPES.DELETED, changeId));
    } else {
      resultArray.push(newArray[i]);
    }
  }
  for (const [index, deletion] of deletions) {
    if (index >= newArray.length) {
      const changeId = `${baseChangeId}-del-${index}`;
      resultArray.push(createChangeNode(deletion, CHANGE_TYPES.DELETED, changeId));
    }
  }
  return resultArray;
}

export function processNestedArrayChange(
  newItem: any,
  oldItem: any,
  nestedChange: any,
  baseChangeId: string,
  path: string[],
  index: number
): any | any[] {
  if (nestedChange.__paragraphTextChange) {
    const { oldParagraph, newParagraph, changeId } = nestedChange;
    const paragraphChanges = createParagraphTextChanges(oldParagraph, newParagraph, changeId);
    return paragraphChanges;
  }
  if (newItem && oldItem) {
    if (newItem.type === 'text' && oldItem.type === 'text' && 
        nestedChange.text && Array.isArray(nestedChange.text) && nestedChange.text.length === 2) {
      const [oldText, newText] = nestedChange.text;
      const changeId = `${baseChangeId}-mod-${index}`;
      const textDiff = handleTextDelta(newItem, oldText, newText, changeId);
      if (textDiff) {
        return textDiff;
      }
    }
    const modifiedItem = JSON.parse(JSON.stringify(newItem));
    const arrayKey = path[path.length - 1] || 'content';
    applyJsonDelta(
      modifiedItem,
      oldItem,
      nestedChange,
      `${baseChangeId}-mod-${index}`,
      [...path, arrayKey, index.toString()]
    );
    return modifiedItem;
  } else if (newItem) {
    return newItem;
  }
  return null;
}