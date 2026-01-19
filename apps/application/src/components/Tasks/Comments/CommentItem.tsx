import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CommentInput } from "./CommentInput";

interface CommentItemProps {
  comment: {
    _id: Id<"taskComments">;
    taskId: Id<"todoItems">;
    authorId: Id<"users">;
    content: string;
    mentions?: Id<"users">[];
    createdAt: number;
    updatedAt?: number;
    isEdited: boolean;
    author: {
      _id: Id<"users">;
      name: string;
      email: string;
      profileImage?: Id<"_storage">;
    } | null;
  };
  caseId: Id<"cases">;
  currentUserId: Id<"users">;
}

/**
 * Render content with mentions resolved to user names
 */
function RenderContentWithMentions({
  content,
  caseId,
}: {
  content: string;
  caseId: Id<"cases">;
}) {
  // Get all case members to resolve mentions
  const members = useQuery(
    api.functions.permissions.getCaseMembersSuggestions,
    {
      caseId,
    },
  );

  // Parse content and replace @[userId] with styled names
  const parts: React.ReactNode[] = [];
  const mentionRegex = /@\[([^\]]+)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    // Find user and add mention
    const userId = match[1];
    const user = members?.find((m) => m.id === userId);
    parts.push(
      <span
        key={match.index}
        className="inline-flex items-center px-1 py-0.5 rounded bg-tertiary/10 text-tertiary text-sm font-medium"
      >
        @{user?.name || "Usuario"}
      </span>,
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return <>{parts}</>;
}

export function CommentItem({
  comment,
  caseId,
  currentUserId,
}: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const updateComment = useMutation(api.functions.comments.updateComment);
  const deleteComment = useMutation(api.functions.comments.deleteComment);

  const isAuthor = comment.authorId === currentUserId;

  const handleSaveEdit = async (newContent: string) => {
    try {
      await updateComment({
        commentId: comment._id,
        content: newContent,
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update comment:", error);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteComment({ commentId: comment._id });
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Failed to delete comment:", error);
    }
  };

  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), {
    addSuffix: true,
    locale: es,
  });

  return (
    <div className="group flex gap-3 py-3">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-tertiary/20 flex items-center justify-center text-sm font-medium text-tertiary shrink-0">
        {comment.author?.name.charAt(0).toUpperCase() || "?"}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-900">
            {comment.author?.name || "Usuario"}
          </span>
          <span className="text-xs text-gray-400">{timeAgo}</span>
          {comment.isEdited && (
            <span className="text-xs text-gray-400">(editado)</span>
          )}
        </div>

        {isEditing ? (
          <CommentInput
            taskId={comment.taskId}
            caseId={caseId}
            initialValue={comment.content}
            isEditing
            onCancel={() => setIsEditing(false)}
            onSave={handleSaveEdit}
          />
        ) : (
          <p className="text-sm text-gray-700 whitespace-pre-wrap wrap-break-word">
            <RenderContentWithMentions
              content={comment.content}
              caseId={caseId}
            />
          </p>
        )}
      </div>

      {/* Actions (only for author) */}
      {isAuthor && !isEditing && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar comentario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El comentario será eliminado
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
