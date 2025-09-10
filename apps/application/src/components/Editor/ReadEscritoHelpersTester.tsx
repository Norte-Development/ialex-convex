import { useState } from 'react';
import { api } from '../../../convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useEscrito } from '@/context/EscritoContext';
import { useMutation, useQuery } from 'convex/react';
import { Id } from '../../../convex/_generated/dataModel';
import { 
  FileText, 
  Play, 
  RotateCcw,
  AlertCircle,
  BookOpen,
  List,
  FileSearch,
  Copy,
  Check
} from 'lucide-react';

interface TestResult {
  operation: string;
  timestamp: string;
  result: any;
  error?: string;
}

export function ReadEscritoHelpersTester() {
  const { escritoId } = useEscrito();
  const [operation, setOperation] = useState<'outline' | 'chunk' | 'full'>('outline');
  const [chunkIndex, setChunkIndex] = useState<number>(0);
  const [contextWindow, setContextWindow] = useState<number>(1);
  const [results, setResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Get the current escrito data
  const escrito = useQuery(api.functions.documents.getEscrito, 
    escritoId ? { escritoId: escritoId as Id<"escritos"> } : "skip"
  );

  // Get the document content for preview
  const documentContent = useQuery(api.prosemirror.getSnapshot, 
    escrito?.prosemirrorId ? { id: escrito.prosemirrorId } : "skip"
  );

  // Mutation to test the readEscrito helpers
  const testReadEscrito = useMutation(api.functions.testReadEscritoHelpers.testReadEscritoHelpers);

  const addResult = (operation: string, result: any, error?: string) => {
    const newResult: TestResult = {
      operation,
      timestamp: new Date().toLocaleTimeString(),
      result,
      error
    };
    setResults(prev => [newResult, ...prev.slice(0, 9)]); // Keep last 10 results
  };

  const clearResults = () => {
    setResults([]);
  };

  const testOperation = async () => {
    if (!escritoId) {
      addResult(operation, null, 'No escrito selected');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await testReadEscrito({
        escritoId: escritoId as Id<"escritos">,
        operation: operation,
        chunkIndex: operation === 'chunk' ? chunkIndex : undefined,
        contextWindow: operation === 'chunk' ? contextWindow : undefined,
      });
      
      addResult(operation, result);
      console.log('ReadEscrito result:', result);
    } catch (error) {
      console.error('Error testing readEscrito:', error);
      addResult(operation, null, error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const getDocumentText = () => {
    if (!documentContent?.content) return 'No content available';
    
    // Simple text extraction
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

  const formatResult = (result: any): string => {
    if (result === null || result === undefined) return 'null';
    if (typeof result === 'string') return result;
    return JSON.stringify(result, null, 2);
  };

  if (!escritoId) {
    return (
      <Card className="w-96 h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Read Escrito Helpers Tester
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>No escrito selected</p>
            <p className="text-sm">Open an escrito to test read helpers</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-96 h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Read Escrito Helpers Tester
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

        {/* Operation Selection */}
        <div className="space-y-3">
          <Label>Select Operation</Label>
          
          <Select 
            value={operation} 
            onValueChange={(value) => setOperation(value as 'outline' | 'chunk' | 'full')}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select operation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="outline">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  Outline
                </div>
              </SelectItem>
              <SelectItem value="chunk">
                <div className="flex items-center gap-2">
                  <FileSearch className="h-4 w-4" />
                  Chunk
                </div>
              </SelectItem>
              <SelectItem value="full">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Full
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Chunk-specific parameters */}
          {operation === 'chunk' && (
            <div className="space-y-2">
              <div>
                <Label>Chunk Index</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={chunkIndex}
                  onChange={(e) => setChunkIndex(parseInt(e.target.value) || 0)}
                  min="0"
                />
              </div>
              <div>
                <Label>Context Window</Label>
                <Input
                  type="number"
                  placeholder="1"
                  value={contextWindow}
                  onChange={(e) => setContextWindow(parseInt(e.target.value) || 1)}
                  min="0"
                />
              </div>
            </div>
          )}

          <Button onClick={testOperation} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Testing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Test {operation.charAt(0).toUpperCase() + operation.slice(1)} Operation
              </>
            )}
          </Button>
        </div>

        <Separator />

        {/* Results */}
        <div className="flex-1 space-y-2 overflow-hidden">
          <div className="flex items-center justify-between">
            <Label>Test Results ({results.length})</Label>
            <Button variant="outline" size="sm" onClick={clearResults}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-2 overflow-y-auto flex-1">
            {results.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <FileText className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">No test results yet</p>
                <p className="text-xs">Run a test to see results here</p>
              </div>
            ) : (
              results.map((result, index) => (
                <div key={index} className="border rounded p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {result.operation}
                      </Badge>
                      <span className="text-xs text-gray-500">{result.timestamp}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(formatResult(result.result), index)}
                      className="h-6 w-6 p-0"
                    >
                      {copiedIndex === index ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  
                  {result.error ? (
                    <div className="text-red-600 text-sm font-mono bg-red-50 p-2 rounded">
                      Error: {result.error}
                    </div>
                  ) : (
                    <div className="text-sm">
                      {result.operation === 'outline' && Array.isArray(result.result) && (
                        <div className="space-y-1">
                          <div className="font-medium">Document Outline:</div>
                          {result.result.map((item: any, i: number) => (
                            <div key={i} className="text-xs bg-white p-2 rounded border">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  {item.type}
                                </Badge>
                                <span className="text-gray-500">Chunk {item.chunkIndex}</span>
                              </div>
                              <div className="mt-1 font-medium">{item.text}</div>
                              <div className="text-gray-500">Position: {item.pos}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {result.operation === 'chunk' && Array.isArray(result.result) && (
                        <div className="space-y-1">
                          <div className="font-medium">Document Chunks:</div>
                          {result.result.map((chunk: any, i: number) => (
                            <div key={i} className="text-xs bg-white p-2 rounded border">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="secondary" className="text-xs">
                                  Chunk {chunk.chunkIndex}
                                </Badge>
                                <span className="text-gray-500">{chunk.wordCount} words</span>
                                {chunk.sectionTitle && (
                                  <Badge variant="outline" className="text-xs">
                                    {chunk.sectionTitle}
                                  </Badge>
                                )}
                              </div>
                              <div className="font-medium mb-1">{chunk.preview}...</div>
                              <details className="text-gray-600">
                                <summary className="cursor-pointer">Full text</summary>
                                <div className="mt-1 whitespace-pre-wrap">{chunk.text}</div>
                              </details>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {result.operation === 'full' && (
                        <div className="text-xs bg-white p-2 rounded border">
                          <div className="font-medium mb-1">Full Document:</div>
                          <div className="whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {formatResult(result.result)}
                          </div>
                        </div>
                      )}
                      
                      {!Array.isArray(result.result) && result.operation !== 'full' && (
                        <div className="text-xs bg-white p-2 rounded border">
                          <div className="whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {formatResult(result.result)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
