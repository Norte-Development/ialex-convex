/**
 * Simple Abort Test
 *
 * A simple test to verify abort functionality works.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SimpleAbortTestProps {
  onTestAbort: () => void;
  isStreaming: boolean;
}

export function SimpleAbortTest({ onTestAbort, isStreaming }: SimpleAbortTestProps) {
  const [clickCount, setClickCount] = useState(0);

  const handleClick = () => {
    setClickCount(prev => prev + 1);
    console.log("🧪 Test button clicked", { clickCount: clickCount + 1, isStreaming });
    onTestAbort();
  };

  return (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Simple Abort Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div>Streaming: {isStreaming ? "✅ Yes" : "❌ No"}</div>
          <div>Clicks: {clickCount}</div>
        </div>
        
        <Button 
          onClick={handleClick}
          variant={isStreaming ? "destructive" : "default"}
        >
          {isStreaming ? "🛑 Test Abort" : "▶️ Test Click"}
        </Button>
        
        <div className="text-xs text-gray-500">
          Check browser console for click logs
        </div>
      </CardContent>
    </Card>
  );
}
