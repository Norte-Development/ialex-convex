import { useCasePermissions } from "@/hooks/useCasePermissions";
import { ACCESS_LEVELS } from "@/permissions/types";
import { Id } from "../../../convex/_generated/dataModel";

interface NewPermissionTesterProps {
  caseId: Id<"cases">;
}

export function NewPermissionTester({ caseId }: NewPermissionTesterProps) {
  const permissions = useCasePermissions(caseId);

  if (permissions.isLoading) {
    return (
      <div className="p-4 border rounded-lg bg-blue-50">
        <div className="animate-pulse">Loading Permissions...</div>
      </div>
    );
  }

  if (!permissions.hasAccess) {
    return (
      <div className="p-4 border rounded-lg bg-red-50">
        <h3 className="font-semibold text-red-800">No Access</h3>
        <p className="text-red-600">You don't have access to this case</p>
      </div>
    );
  }

  const accessLevelTests = [
    {
      level: ACCESS_LEVELS.BASIC,
      description: "Basic Access",
      canAccess: permissions.hasAccessLevel(ACCESS_LEVELS.BASIC),
    },
    {
      level: ACCESS_LEVELS.ADVANCED,
      description: "Advanced Access",
      canAccess: permissions.hasAccessLevel(ACCESS_LEVELS.ADVANCED),
    },
    {
      level: ACCESS_LEVELS.ADMIN,
      description: "Admin Access",
      canAccess: permissions.hasAccessLevel(ACCESS_LEVELS.ADMIN),
    },
  ];

  const capabilities = [
    { name: "View Case", can: permissions.can.viewCase },
    { name: "Edit Case", can: permissions.can.editCase },
    { name: "Delete Case", can: permissions.can.deleteCase },
    { name: "Manage Case", can: permissions.can.manageCase },
    { name: "Read Documents", can: permissions.can.docs.read },
    { name: "Write Documents", can: permissions.can.docs.write },
    { name: "Delete Documents", can: permissions.can.docs.delete },
    { name: "Read Escritos", can: permissions.can.escritos.read },
    { name: "Write Escritos", can: permissions.can.escritos.write },
    { name: "Delete Escritos", can: permissions.can.escritos.delete },
    { name: "Chat Access", can: permissions.can.chat },
    { name: "Grant Permissions", can: permissions.can.permissions.grant },
    { name: "Revoke Permissions", can: permissions.can.permissions.revoke },
  ];

  return (
    <div className="p-6 border rounded-lg bg-green-50">
      <h2 className="text-xl font-bold text-green-800 mb-4">
        🧪 New Permissions System Test
      </h2>

      {/* Current Access Info */}
      <div className="mb-6 p-4 bg-white rounded border">
        <h3 className="font-semibold mb-2">Current Access:</h3>
        <div className="space-y-1">
          <p>
            <strong>Level:</strong>{" "}
            <span className="px-2 py-1 bg-blue-100 rounded text-sm">
              {permissions.accessLevel || "none"}
            </span>
          </p>
          <p>
            <strong>Source:</strong>{" "}
            <span className="px-2 py-1 bg-gray-100 rounded text-sm">
              {permissions.source || "none"}
            </span>
          </p>
          <p>
            <strong>Has Access:</strong>{" "}
            <span
              className={`px-2 py-1 rounded text-sm ${permissions.hasAccess ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
            >
              {permissions.hasAccess ? "✅ Yes" : "❌ No"}
            </span>
          </p>
        </div>
      </div>

      {/* Access Level Tests */}
      <div className="mb-6">
        <h3 className="font-semibold mb-2">Access Level Hierarchy Tests:</h3>
        <div className="grid grid-cols-3 gap-2">
          {accessLevelTests.map((test) => (
            <div
              key={test.level}
              className={`p-3 rounded border text-sm ${test.canAccess ? "bg-green-100 border-green-300" : "bg-gray-100 border-gray-300"}`}
            >
              <div className="font-medium">{test.description}</div>
              <div
                className={test.canAccess ? "text-green-700" : "text-gray-500"}
              >
                {test.canAccess ? "✅ Allowed" : "❌ Denied"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Capability Tests */}
      <div>
        <h3 className="font-semibold mb-2">Capability Tests:</h3>
        <div className="grid grid-cols-2 gap-2">
          {capabilities.map((capability) => (
            <div
              key={capability.name}
              className={`p-2 rounded border text-sm ${capability.can ? "bg-green-100 border-green-300" : "bg-red-100 border-red-300"}`}
            >
              <span className="font-medium">{capability.name}:</span>
              <span
                className={`ml-2 ${capability.can ? "text-green-700" : "text-red-700"}`}
              >
                {capability.can ? "✅" : "❌"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
