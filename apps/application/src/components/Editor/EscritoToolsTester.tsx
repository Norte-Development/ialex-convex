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
import { useEscrito } from '@/context/EscritoContext';
import { useMutation, useQuery } from 'convex/react';
import { Id } from '../../../convex/_generated/dataModel';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Play, 
  RotateCcw,
  AlertCircle
} from 'lucide-react';

interface EditOperation {
  id: string;
  type: 'replace' | 'insert' | 'delete' | 'add_mark' | 'remove_mark' | 'replace_mark';
  findText?: string;
  replaceText?: string;
  insertText?: string;
  deleteText?: string;
  text?: string; // For mark operations
  markType?: 'bold' | 'italic' | 'code' | 'strike' | 'underline';
  oldMarkType?: 'bold' | 'italic' | 'code' | 'strike' | 'underline';
  newMarkType?: 'bold' | 'italic' | 'code' | 'strike' | 'underline';
  contextBefore?: string;
  contextAfter?: string;
  replaceAll?: boolean;
  afterText?: string;
  beforeText?: string;
}



export function EscritoToolsTester() {
  const { escritoId } = useEscrito();
  const [operations, setOperations] = useState<EditOperation[]>([]);
  const [currentOperation, setCurrentOperation] = useState<Partial<EditOperation>>({
    type: 'replace'
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
    <Card className="w-80 h-full flex flex-col">
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
                <input
                  type="checkbox"
                  id="replaceAll"
                  checked={currentOperation.replaceAll || false}
                  onChange={(e) => setCurrentOperation(prev => ({ ...prev, replaceAll: e.target.checked }))}
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

          {currentOperation.type === 'add_mark' && (
            <div className="space-y-2">
              <div>
                <Label>Text to Mark</Label>
                <Input
                  placeholder="Text to add mark to"
                  value={currentOperation.text || ''}
                  onChange={(e) => setCurrentOperation(prev => ({ ...prev, text: e.target.value }))}
                />
              </div>
              <div>
                <Label>Mark Type</Label>
                <Select 
                  value={currentOperation.markType || ''} 
                  onValueChange={(value) => setCurrentOperation(prev => ({ ...prev, markType: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select mark type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bold">Bold</SelectItem>
                    <SelectItem value="italic">Italic</SelectItem>
                    <SelectItem value="code">Code</SelectItem>
                    <SelectItem value="strike">Strikethrough</SelectItem>
                    <SelectItem value="underline">Underline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Context Before (optional)</Label>
                <Input
                  placeholder="Text that should appear before"
                  value={currentOperation.contextBefore || ''}
                  onChange={(e) => setCurrentOperation(prev => ({ ...prev, contextBefore: e.target.value }))}
                />
              </div>
              <div>
                <Label>Context After (optional)</Label>
                <Input
                  placeholder="Text that should appear after"
                  value={currentOperation.contextAfter || ''}
                  onChange={(e) => setCurrentOperation(prev => ({ ...prev, contextAfter: e.target.value }))}
                />
              </div>
            </div>
          )}

          {currentOperation.type === 'remove_mark' && (
            <div className="space-y-2">
              <div>
                <Label>Text to Remove Mark From</Label>
                <Input
                  placeholder="Text to remove mark from"
                  value={currentOperation.text || ''}
                  onChange={(e) => setCurrentOperation(prev => ({ ...prev, text: e.target.value }))}
                />
              </div>
              <div>
                <Label>Mark Type to Remove</Label>
                <Select 
                  value={currentOperation.markType || ''} 
                  onValueChange={(value) => setCurrentOperation(prev => ({ ...prev, markType: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select mark type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bold">Bold</SelectItem>
                    <SelectItem value="italic">Italic</SelectItem>
                    <SelectItem value="code">Code</SelectItem>
                    <SelectItem value="strike">Strikethrough</SelectItem>
                    <SelectItem value="underline">Underline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Context Before (optional)</Label>
                <Input
                  placeholder="Text that should appear before"
                  value={currentOperation.contextBefore || ''}
                  onChange={(e) => setCurrentOperation(prev => ({ ...prev, contextBefore: e.target.value }))}
                />
              </div>
              <div>
                <Label>Context After (optional)</Label>
                <Input
                  placeholder="Text that should appear after"
                  value={currentOperation.contextAfter || ''}
                  onChange={(e) => setCurrentOperation(prev => ({ ...prev, contextAfter: e.target.value }))}
                />
              </div>
            </div>
          )}

          {currentOperation.type === 'replace_mark' && (
            <div className="space-y-2">
              <div>
                <Label>Text to Change Mark</Label>
                <Input
                  placeholder="Text to change mark on"
                  value={currentOperation.text || ''}
                  onChange={(e) => setCurrentOperation(prev => ({ ...prev, text: e.target.value }))}
                />
              </div>
              <div>
                <Label>Current Mark Type</Label>
                <Select 
                  value={currentOperation.oldMarkType || ''} 
                  onValueChange={(value) => setCurrentOperation(prev => ({ ...prev, oldMarkType: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select current mark" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bold">Bold</SelectItem>
                    <SelectItem value="italic">Italic</SelectItem>
                    <SelectItem value="code">Code</SelectItem>
                    <SelectItem value="strike">Strikethrough</SelectItem>
                    <SelectItem value="underline">Underline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>New Mark Type</Label>
                <Select 
                  value={currentOperation.newMarkType || ''} 
                  onValueChange={(value) => setCurrentOperation(prev => ({ ...prev, newMarkType: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select new mark" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bold">Bold</SelectItem>
                    <SelectItem value="italic">Italic</SelectItem>
                    <SelectItem value="code">Code</SelectItem>
                    <SelectItem value="strike">Strikethrough</SelectItem>
                    <SelectItem value="underline">Underline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Context Before (optional)</Label>
                <Input
                  placeholder="Text that should appear before"
                  value={currentOperation.contextBefore || ''}
                  onChange={(e) => setCurrentOperation(prev => ({ ...prev, contextBefore: e.target.value }))}
                />
              </div>
              <div>
                <Label>Context After (optional)</Label>
                <Input
                  placeholder="Text that should appear after"
                  value={currentOperation.contextAfter || ''}
                  onChange={(e) => setCurrentOperation(prev => ({ ...prev, contextAfter: e.target.value }))}
                />
              </div>
            </div>
          )}

          <Button onClick={addOperation} size="sm" className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Operation
          </Button>
        </div>

        <Separator />

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
                  {op.type === 'add_mark' && (
                    <>
                      <div><strong>Text:</strong> {op.text}</div>
                      <div><strong>Add Mark:</strong> {op.markType}</div>
                    </>
                  )}
                  {op.type === 'remove_mark' && (
                    <>
                      <div><strong>Text:</strong> {op.text}</div>
                      <div><strong>Remove Mark:</strong> {op.markType}</div>
                    </>
                  )}
                  {op.type === 'replace_mark' && (
                    <>
                      <div><strong>Text:</strong> {op.text}</div>
                      <div><strong>Change:</strong> {op.oldMarkType} → {op.newMarkType}</div>
                    </>
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
              Test Operations
            </>
          )}
        </Button>

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
