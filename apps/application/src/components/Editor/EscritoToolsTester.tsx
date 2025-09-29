import { useState } from 'react';
import { api } from '../../../convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEscrito } from '@/context/EscritoContext';
import { useMutation, useQuery, useAction } from 'convex/react';
import { Id } from '../../../convex/_generated/dataModel';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Play, 
  RotateCcw,
  AlertCircle,
  Code,
  Type
} from 'lucide-react';

interface EditOperation {
  id: string;
  type: 'replace' | 'insert' | 'delete' | 'add_mark' | 'remove_mark' | 'replace_mark' | 'add_paragraph';
  findText?: string;
  replaceText?: string;
  insertText?: string;
  deleteText?: string;
  text?: string; // For mark operations
  markType?: 'bold' | 'italic' | 'code' | 'strike' | 'underline';
  oldMarkType?: 'bold' | 'italic' | 'code' | 'strike' | 'underline';
  newMarkType?: 'bold' | 'italic' | 'code' | 'strike' | 'underline';
  // Paragraph operations
  paragraphType?: 'paragraph' | 'heading' | 'blockquote' | 'bulletList' | 'orderedList' | 'codeBlock';
  headingLevel?: number;
  content?: string;
  contextBefore?: string;
  contextAfter?: string;
  replaceAll?: boolean;
  afterText?: string;
  beforeText?: string;
}

interface HtmlDiff {
  id: string;
  context?: string;
  delete: string;
  insert: string;
}

interface HtmlInsertion {
  id: string;
  html: string;
  position: string | number;
}

interface TestOptions {
  caseSensitive: boolean;
  preferLastContext: boolean;
  strict: boolean;
  chunkSize: number;
  chunkIndex?: number;
}



export function EscritoToolsTester() {
  const { escritoId } = useEscrito();
  const [operations, setOperations] = useState<EditOperation[]>([]);
  const [currentOperation, setCurrentOperation] = useState<Partial<EditOperation>>({
    type: 'replace'
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // HTML testing state
  const [htmlDiffs, setHtmlDiffs] = useState<HtmlDiff[]>([]);
  const [currentHtmlDiff, setCurrentHtmlDiff] = useState<Partial<HtmlDiff>>({
    delete: '',
    insert: ''
  });
  const [htmlInsertions, setHtmlInsertions] = useState<HtmlInsertion[]>([]);
  const [currentHtmlInsertion, setCurrentHtmlInsertion] = useState<Partial<HtmlInsertion>>({
    html: '',
    position: 'documentEnd'
  });
  const [testOptions, setTestOptions] = useState<TestOptions>({
    caseSensitive: true,
    preferLastContext: false,
    strict: false,
    chunkSize: 32000
  });

  // Get the current escrito data
  const escrito = useQuery(api.functions.documents.getEscrito, 
    escritoId ? { escritoId: escritoId as Id<"escritos"> } : "skip"
  );

  // Get the document content
  const documentContent = useQuery(api.prosemirror.getSnapshot, 
    escrito?.prosemirrorId ? { id: escrito.prosemirrorId } : "skip"
  );

  // Mutations
  const applyTextBasedOperations = useMutation(api.functions.escritosTransforms.applyTextBasedOperations);
  
  // Actions (not mutations)
  const insertHtmlAction = useAction(api.editor.edit.insertHtmlAction);
  const applyHtmlDiff = useAction(api.editor.edit.applyHtmlDiff);

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setLogs(prev => [logEntry, ...prev.slice(0, 49)]); // Keep last 50 logs
    console.log(`[${type.toUpperCase()}] ${message}`);
  };

  const addOperation = () => {
    if (!currentOperation.type) {
      addLog('Please select an operation type', 'error');
      return;
    }

    const newOperation: EditOperation = {
      id: Date.now().toString(),
      type: currentOperation.type,
      ...currentOperation
    };

    setOperations(prev => [...prev, newOperation]);
    setCurrentOperation({ type: 'replace' });
    addLog(`Added ${currentOperation.type} operation`);
  };

  const removeOperation = (id: string) => {
    setOperations(prev => prev.filter(op => op.id !== id));
    addLog('Removed operation');
  };

  const clearOperations = () => {
    setOperations([]);
    addLog('Cleared all operations');
  };

  // HTML Diff functions
  const addHtmlDiff = () => {
    if (!currentHtmlDiff.delete || !currentHtmlDiff.insert) {
      addLog('Please provide both delete and insert text for HTML diff', 'error');
      return;
    }

    const newDiff: HtmlDiff = {
      id: Date.now().toString(),
      context: currentHtmlDiff.context,
      delete: currentHtmlDiff.delete,
      insert: currentHtmlDiff.insert
    };

    setHtmlDiffs(prev => [...prev, newDiff]);
    setCurrentHtmlDiff({ delete: '', insert: '' });
    addLog(`Added HTML diff: "${currentHtmlDiff.delete}" -> "${currentHtmlDiff.insert}"`);
  };

  const removeHtmlDiff = (id: string) => {
    setHtmlDiffs(prev => prev.filter(diff => diff.id !== id));
    addLog('Removed HTML diff');
  };

  const clearHtmlDiffs = () => {
    setHtmlDiffs([]);
    addLog('Cleared all HTML diffs');
  };

  // HTML Insertion functions
  const addHtmlInsertion = () => {
    if (!currentHtmlInsertion.html) {
      addLog('Please provide HTML content to insert', 'error');
      return;
    }

    const newInsertion: HtmlInsertion = {
      id: Date.now().toString(),
      html: currentHtmlInsertion.html,
      position: currentHtmlInsertion.position || 'documentEnd'
    };

    setHtmlInsertions(prev => [...prev, newInsertion]);
    setCurrentHtmlInsertion({ html: '', position: 'documentEnd' });
    addLog(`Added HTML insertion at position: ${currentHtmlInsertion.position}`);
  };

  const removeHtmlInsertion = (id: string) => {
    setHtmlInsertions(prev => prev.filter(insertion => insertion.id !== id));
    addLog('Removed HTML insertion');
  };

  const clearHtmlInsertions = () => {
    setHtmlInsertions([]);
    addLog('Cleared all HTML insertions');
  };

  const testOperations = async () => {
    if (!escritoId || operations.length === 0) {
      addLog('No escrito selected or no operations to apply', 'error');
      return;
    }

    setIsLoading(true);
    addLog('Starting to apply operations...');

    try {
      // Log the operations being prepared
      addLog(`Preparing ${operations.length} operations...`);
      
      operations.forEach((op, index) => {
        addLog(`Operation ${index + 1}: ${op.type}`);
        if (op.type === 'replace') {
          addLog(`  Find: "${op.findText}"`);
          addLog(`  Replace: "${op.replaceText}"`);
        } else if (op.type === 'insert') {
          addLog(`  Insert: "${op.insertText}"`);
        } else if (op.type === 'delete') {
          addLog(`  Delete: "${op.deleteText}"`);
        } else if (op.type === 'add_mark') {
          addLog(`  Text: "${op.text}"`);
          addLog(`  Add Mark: ${op.markType}`);
        } else if (op.type === 'remove_mark') {
          addLog(`  Text: "${op.text}"`);
          addLog(`  Remove Mark: ${op.markType}`);
        } else if (op.type === 'replace_mark') {
          addLog(`  Text: "${op.text}"`);
          addLog(`  Change: ${op.oldMarkType} -> ${op.newMarkType}`);
        } else if (op.type === 'add_paragraph') {
          addLog(`  Content: "${op.content}"`);
          addLog(`  Type: ${op.paragraphType}${op.headingLevel ? ` (H${op.headingLevel})` : ''}`);
        }
      });

      // Convert operations to the format expected by the mutation (remove id field)
      const editsForMutation = operations.map(({ id, ...edit }) => edit);
      
      // Call the text-based mutation directly
      addLog(`Calling applyTextBasedOperations mutation...`);
      const result = await applyTextBasedOperations({
        escritoId: escritoId as Id<"escritos">,
        edits: editsForMutation as any
      });

      addLog(`Successfully applied operations!`, 'success');
      addLog(`Mutation result: ${JSON.stringify(result, null, 2)}`);

      // Clear operations after successful application
      setOperations([]);
      addLog('Operations cleared from queue');

    } catch (error) {
      addLog(`Error applying operations: ${error}`, 'error');
      console.error('Mutation error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testHtmlDiffs = async () => {
    if (!escritoId || htmlDiffs.length === 0) {
      addLog('No escrito selected or no HTML diffs to apply', 'error');
      return;
    }

    setIsLoading(true);
    addLog('Starting to apply HTML diffs...');

    try {
      // Convert HTML diffs to the format expected by the mutation (remove id field)
      const diffsForMutation = htmlDiffs.map(({ id, ...diff }) => diff);
      
      addLog(`Applying ${diffsForMutation.length} HTML diffs...`);
      diffsForMutation.forEach((diff, index) => {
        addLog(`Diff ${index + 1}: "${diff.delete}" -> "${diff.insert}"${diff.context ? ` (context: "${diff.context}")` : ''}`);
      });

      const result = await applyHtmlDiff({
        escritoId: escritoId as Id<"escritos">,
        diffs: diffsForMutation,
        options: {
          caseSensitive: testOptions.caseSensitive,
          preferLastContext: testOptions.preferLastContext,
          strict: testOptions.strict
        },
        chunkSize: testOptions.chunkSize,
        chunkIndex: testOptions.chunkIndex
      });

      addLog(`Successfully applied HTML diffs!`, 'success');
      addLog(`Applied: ${result.applied}, Failed: ${result.failed}`);
      if (result.unmatchedDiffIndexes.length > 0) {
        addLog(`Unmatched diff indexes: ${result.unmatchedDiffIndexes.join(', ')}`, 'error');
      }
      if (result.strictAborted) {
        addLog('Operation aborted due to strict mode', 'error');
      }

      // Clear diffs after successful application
      setHtmlDiffs([]);
      addLog('HTML diffs cleared from queue');

    } catch (error) {
      addLog(`Error applying HTML diffs: ${error}`, 'error');
      console.error('HTML diff error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testHtmlInsertions = async () => {
    if (!escritoId || htmlInsertions.length === 0) {
      addLog('No escrito selected or no HTML insertions to apply', 'error');
      return;
    }

    setIsLoading(true);
    addLog('Starting to apply HTML insertions...');

    try {
      for (const insertion of htmlInsertions) {
        addLog(`Inserting HTML at position: ${insertion.position}`);
        
        const result = await insertHtmlAction({
          escritoId: escritoId as Id<"escritos">,
          html: insertion.html,
          position: insertion.position as any
        });

        addLog(`Successfully inserted HTML: ${result.message}`, 'success');
      }

      // Clear insertions after successful application
      setHtmlInsertions([]);
      addLog('HTML insertions cleared from queue');

    } catch (error) {
      addLog(`Error applying HTML insertions: ${error}`, 'error');
      console.error('HTML insertion error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDocumentText = () => {
    if (!documentContent?.content) return 'No content available';
    
    // Simple text extraction - in a real implementation you'd use the same logic as the tools
    const extractText = (node: any): string => {
      if (typeof node === 'string') return node;
      if (node.type === 'text') return node.text || '';
      if (node.content && Array.isArray(node.content)) {
        return node.content.map(extractText).join('');
      }
      return '';
    };

    return extractText(documentContent.content);
  };

  if (!escritoId) {
    return (
      <Card className="w-80 h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Escrito Tools Tester
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>No escrito selected</p>
            <p className="text-sm">Open an escrito to test editing tools</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-96 h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Escrito Tools Tester
        </CardTitle>
        <div className="text-sm text-gray-600">
          Testing: {escrito?.title || 'Loading...'}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Document Info */}
        <div className="space-y-2">
          <Label>Current Document</Label>
          <div className="text-xs bg-gray-50 p-2 rounded border max-h-20 overflow-y-auto">
            {getDocumentText().substring(0, 200)}...
          </div>
        </div>

        <Separator />

        {/* Testing Tabs */}
        <Tabs defaultValue="text" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="text" className="flex items-center gap-1">
              <Type className="h-3 w-3" />
              Text
            </TabsTrigger>
            <TabsTrigger value="html-diff" className="flex items-center gap-1">
              <Code className="h-3 w-3" />
              HTML Diff
            </TabsTrigger>
            <TabsTrigger value="html-insert" className="flex items-center gap-1">
              <Plus className="h-3 w-3" />
              HTML Insert
            </TabsTrigger>
          </TabsList>

          {/* Text Operations Tab */}
          <TabsContent value="text" className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* Add Operation */}
            <div className="space-y-3">
              <Label>Add Operation</Label>
              
              <Select 
                value={currentOperation.type} 
                onValueChange={(value) => setCurrentOperation(prev => ({ ...prev, type: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select operation type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="replace">Replace Text</SelectItem>
                  <SelectItem value="insert">Insert Text</SelectItem>
                  <SelectItem value="delete">Delete Text</SelectItem>
                  <SelectItem value="add_mark">Add Mark (Bold, Italic, etc.)</SelectItem>
                  <SelectItem value="remove_mark">Remove Mark</SelectItem>
                  <SelectItem value="replace_mark">Replace Mark</SelectItem>
                  <SelectItem value="add_paragraph">Add Paragraph</SelectItem>
                </SelectContent>
              </Select>

              {currentOperation.type === 'replace' && (
                <div className="space-y-2">
                  <div>
                    <Label>Find Text</Label>
                    <Input
                      placeholder="Text to find"
                      value={currentOperation.findText || ''}
                      onChange={(e) => setCurrentOperation(prev => ({ ...prev, findText: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Replace With</Label>
                    <Input
                      placeholder="Replacement text"
                      value={currentOperation.replaceText || ''}
                      onChange={(e) => setCurrentOperation(prev => ({ ...prev, replaceText: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="replaceAll"
                      checked={currentOperation.replaceAll || false}
                      onCheckedChange={(checked) => setCurrentOperation(prev => ({ ...prev, replaceAll: !!checked }))}
                    />
                    <Label htmlFor="replaceAll" className="text-sm">Replace all occurrences</Label>
                  </div>
                </div>
              )}

              {currentOperation.type === 'insert' && (
                <div className="space-y-2">
                  <div>
                    <Label>Text to Insert</Label>
                    <Textarea
                      placeholder="Text to insert"
                      value={currentOperation.insertText || ''}
                      onChange={(e) => setCurrentOperation(prev => ({ ...prev, insertText: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label>After Text (optional)</Label>
                    <Input
                      placeholder="Insert after this text"
                      value={currentOperation.afterText || ''}
                      onChange={(e) => setCurrentOperation(prev => ({ ...prev, afterText: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Before Text (optional)</Label>
                    <Input
                      placeholder="Insert before this text"
                      value={currentOperation.beforeText || ''}
                      onChange={(e) => setCurrentOperation(prev => ({ ...prev, beforeText: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {currentOperation.type === 'delete' && (
                <div className="space-y-2">
                  <div>
                    <Label>Text to Delete</Label>
                    <Input
                      placeholder="Text to delete"
                      value={currentOperation.deleteText || ''}
                      onChange={(e) => setCurrentOperation(prev => ({ ...prev, deleteText: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              <Button onClick={addOperation} size="sm" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Operation
              </Button>
            </div>

            {/* Operations List */}
            <div className="flex-1 space-y-2 overflow-hidden">
              <div className="flex items-center justify-between">
                <Label>Operations ({operations.length})</Label>
                <Button variant="outline" size="sm" onClick={clearOperations}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-2 overflow-y-auto flex-1">
                {operations.map((op) => (
                  <div key={op.id} className="border rounded p-2 bg-gray-50">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="text-xs">
                        {op.type}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOperation(op.id)}
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-xs space-y-1">
                      {op.type === 'replace' && (
                        <>
                          <div><strong>Find:</strong> {op.findText}</div>
                          <div><strong>Replace:</strong> {op.replaceText}</div>
                        </>
                      )}
                      {op.type === 'insert' && (
                        <div><strong>Insert:</strong> {op.insertText}</div>
                      )}
                      {op.type === 'delete' && (
                        <div><strong>Delete:</strong> {op.deleteText}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Test Button */}
            <Button 
              onClick={testOperations} 
              disabled={isLoading || operations.length === 0}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Testing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Test Text Operations
                </>
              )}
            </Button>
          </TabsContent>

          {/* HTML Diff Tab */}
          <TabsContent value="html-diff" className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* Test Options */}
            <div className="space-y-3">
              <Label>Test Options</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="caseSensitive"
                    checked={testOptions.caseSensitive}
                    onCheckedChange={(checked) => setTestOptions(prev => ({ ...prev, caseSensitive: !!checked }))}
                  />
                  <Label htmlFor="caseSensitive" className="text-sm">Case Sensitive</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="preferLastContext"
                    checked={testOptions.preferLastContext}
                    onCheckedChange={(checked) => setTestOptions(prev => ({ ...prev, preferLastContext: !!checked }))}
                  />
                  <Label htmlFor="preferLastContext" className="text-sm">Prefer Last Context</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="strict"
                    checked={testOptions.strict}
                    onCheckedChange={(checked) => setTestOptions(prev => ({ ...prev, strict: !!checked }))}
                  />
                  <Label htmlFor="strict" className="text-sm">Strict Mode</Label>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Chunk Size</Label>
                  <Input
                    type="number"
                    value={testOptions.chunkSize}
                    onChange={(e) => setTestOptions(prev => ({ ...prev, chunkSize: parseInt(e.target.value) || 32000 }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Chunk Index (optional)</Label>
                  <Input
                    type="number"
                    placeholder="Leave empty for whole document"
                    value={testOptions.chunkIndex || ''}
                    onChange={(e) => setTestOptions(prev => ({ ...prev, chunkIndex: e.target.value ? parseInt(e.target.value) : undefined }))}
                  />
                </div>
              </div>
            </div>

            {/* Add HTML Diff */}
            <div className="space-y-3">
              <Label>Add HTML Diff</Label>
              <div className="space-y-2">
                <div>
                  <Label>Context (optional)</Label>
                  <Input
                    placeholder="Context text for anchoring"
                    value={currentHtmlDiff.context || ''}
                    onChange={(e) => setCurrentHtmlDiff(prev => ({ ...prev, context: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Delete Text</Label>
                  <Input
                    placeholder="Text to delete"
                    value={currentHtmlDiff.delete || ''}
                    onChange={(e) => setCurrentHtmlDiff(prev => ({ ...prev, delete: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Insert Text</Label>
                  <Input
                    placeholder="Text to insert"
                    value={currentHtmlDiff.insert || ''}
                    onChange={(e) => setCurrentHtmlDiff(prev => ({ ...prev, insert: e.target.value }))}
                  />
                </div>
              </div>
              <Button onClick={addHtmlDiff} size="sm" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add HTML Diff
              </Button>
            </div>

            {/* HTML Diffs List */}
            <div className="flex-1 space-y-2 overflow-hidden">
              <div className="flex items-center justify-between">
                <Label>HTML Diffs ({htmlDiffs.length})</Label>
                <Button variant="outline" size="sm" onClick={clearHtmlDiffs}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-2 overflow-y-auto flex-1">
                {htmlDiffs.map((diff) => (
                  <div key={diff.id} className="border rounded p-2 bg-gray-50">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="text-xs">
                        HTML Diff
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeHtmlDiff(diff.id)}
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-xs space-y-1">
                      {diff.context && <div><strong>Context:</strong> {diff.context}</div>}
                      <div><strong>Delete:</strong> {diff.delete}</div>
                      <div><strong>Insert:</strong> {diff.insert}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Test Button */}
            <Button 
              onClick={testHtmlDiffs} 
              disabled={isLoading || htmlDiffs.length === 0}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Testing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Test HTML Diffs
                </>
              )}
            </Button>
          </TabsContent>

          {/* HTML Insert Tab */}
          <TabsContent value="html-insert" className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* Add HTML Insertion */}
            <div className="space-y-3">
              <Label>Add HTML Insertion</Label>
              <div className="space-y-2">
                <div>
                  <Label>HTML Content</Label>
                  <Textarea
                    placeholder="<p>HTML content to insert</p>"
                    value={currentHtmlInsertion.html || ''}
                    onChange={(e) => setCurrentHtmlInsertion(prev => ({ ...prev, html: e.target.value }))}
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Insert Position</Label>
                  <Select 
                    value={currentHtmlInsertion.position?.toString() || 'documentEnd'} 
                    onValueChange={(value) => setCurrentHtmlInsertion(prev => ({ ...prev, position: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="documentStart">Document Start</SelectItem>
                      <SelectItem value="documentEnd">Document End</SelectItem>
                      <SelectItem value="document">Replace Entire Document</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={addHtmlInsertion} size="sm" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add HTML Insertion
              </Button>
            </div>

            {/* HTML Insertions List */}
            <div className="flex-1 space-y-2 overflow-hidden">
              <div className="flex items-center justify-between">
                <Label>HTML Insertions ({htmlInsertions.length})</Label>
                <Button variant="outline" size="sm" onClick={clearHtmlInsertions}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-2 overflow-y-auto flex-1">
                {htmlInsertions.map((insertion) => (
                  <div key={insertion.id} className="border rounded p-2 bg-gray-50">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="text-xs">
                        HTML Insert
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeHtmlInsertion(insertion.id)}
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-xs space-y-1">
                      <div><strong>Position:</strong> {insertion.position}</div>
                      <div><strong>HTML:</strong> {insertion.html.substring(0, 50)}...</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Test Button */}
            <Button 
              onClick={testHtmlInsertions} 
              disabled={isLoading || htmlInsertions.length === 0}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Testing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Test HTML Insertions
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>

        <Separator />

        {/* Logs */}
        <div className="space-y-2">
          <Label>Logs</Label>
          <div className="bg-black text-green-400 p-2 rounded text-xs font-mono h-32 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-gray-500">No logs yet...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="whitespace-pre-wrap">{log}</div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
