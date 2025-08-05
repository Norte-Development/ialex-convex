import { useCasePermissions } from "@/hooks/useCasePermissions";
import { PERMISSIONS } from "@/permissions/types";
import { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

interface PermissionTesterProps {
  caseId: Id<"cases"> | null;
}

export function PermissionTester({ caseId }: PermissionTesterProps) {
  const permissions = useCasePermissions(caseId);

  if (permissions.isLoading) {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading Permissions...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (!permissions.hasAccess) {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            No Access to Case
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">You don't have access to this case.</p>
        </CardContent>
      </Card>
    );
  }

  const permissionTests = [
    { name: "View Case", permission: PERMISSIONS.CASE_VIEW, can: permissions.can.viewCase },
    { name: "Edit Case", permission: PERMISSIONS.CASE_EDIT, can: permissions.can.editCase },
    { name: "Delete Case", permission: PERMISSIONS.CASE_DELETE, can: permissions.can.deleteCase },
    { name: "Read Documents", permission: PERMISSIONS.DOC_READ, can: permissions.can.docs.read },
    { name: "Write Documents", permission: PERMISSIONS.DOC_WRITE, can: permissions.can.docs.write },
    { name: "Delete Documents", permission: PERMISSIONS.DOC_DELETE, can: permissions.can.docs.delete },
    { name: "Read Escritos", permission: PERMISSIONS.ESCRITO_READ, can: permissions.can.escritos.read },
    { name: "Write Escritos", permission: PERMISSIONS.ESCRITO_WRITE, can: permissions.can.escritos.write },
    { name: "Delete Escritos", permission: PERMISSIONS.ESCRITO_DELETE, can: permissions.can.escritos.delete },
    { name: "Read Clients", permission: PERMISSIONS.CLIENT_READ, can: permissions.can.clients.read },
    { name: "Write Clients", permission: PERMISSIONS.CLIENT_WRITE, can: permissions.can.clients.write },
    { name: "Delete Clients", permission: PERMISSIONS.CLIENT_DELETE, can: permissions.can.clients.delete },
    { name: "Read Teams", permission: PERMISSIONS.TEAM_READ, can: permissions.can.teams.read },
    { name: "Write Teams", permission: PERMISSIONS.TEAM_WRITE, can: permissions.can.teams.write },
    { name: "Access Chat", permission: PERMISSIONS.CHAT_ACCESS, can: permissions.can.chat },
    { name: "Full Access", permission: PERMISSIONS.FULL, can: permissions.canDoEverything },
  ];

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-600">
          <CheckCircle className="h-5 w-5" />
          Permission System Test
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            Access Level: {permissions.accessLevel}
          </Badge>
          <Badge variant="outline">
            Source: {permissions.source}
          </Badge>
          <Badge variant="outline">
            Permissions: {permissions.permissions.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-gray-700 mb-3">
            Raw Permissions: {permissions.permissions.join(", ")}
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {permissionTests.map((test) => (
              <div key={test.permission} className="flex items-center justify-between p-2 border rounded-lg">
                <span className="text-sm font-medium">{test.name}</span>
                <div className="flex items-center gap-2">
                  {test.can ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <Badge variant={test.can ? "default" : "secondary"} className="text-xs">
                    {test.can ? "Allow" : "Deny"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 