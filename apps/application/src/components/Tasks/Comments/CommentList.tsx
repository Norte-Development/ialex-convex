import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { CommentItem } from "./CommentItem";
import { CommentInput } from "./CommentInput";
import { useAuth } from "@/context/AuthContext";
import { MessageSquare } from "lucide-react";

interface CommentListProps {
  taskId: Id<"todoItems">;
  caseId: Id<"cases">;
}

export function CommentList({ taskId, caseId }: CommentListProps) {
  const { user } = useAuth();
  const comments = useQuery(api.functions.comments.listCommentsByTask, {
    taskId,
  });

  if (!user) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-gray-500" />
        <h3 className="text-sm font-medium text-gray-700">
          Comentarios{" "}
          {comments && comments.length > 0 && `(${comments.length})`}
        </h3>
      </div>

      {/* Comments */}
      {comments && comments.length > 0 ? (
        <div className="divide-y divide-gray-100">
          {comments.map((comment) => (
            <CommentItem
              key={comment._id}
              comment={comment as any}
              caseId={caseId}
              currentUserId={user._id as Id<"users">}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 py-4 text-center">
          No hay comentarios aún
        </p>
      )}

      {/* Input */}
      <div className="pt-2 border-t border-gray-100">
        <CommentInput taskId={taskId} caseId={caseId} />
      </div>
    </div>
  );
}
