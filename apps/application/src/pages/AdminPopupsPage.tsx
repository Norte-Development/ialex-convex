import { RequireAdminsOrg } from "@/components/Auth/RequireAdminsOrg";
import { Shield } from "lucide-react";

export default function AdminPopupsPage() {
  return (
    <RequireAdminsOrg>
      <div className="flex flex-col w-full justify-center items-center h-screen ">
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Pop-ups</h1>
          </div>
          <p className="text-muted-foreground">
            Panel para crear y administrar pop-ups informativos y de marketing.
          </p>
        </div>
      </div>
    </RequireAdminsOrg>
  );
}
