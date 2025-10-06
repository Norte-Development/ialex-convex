import { WorkflowTest } from "../components/Agent";

export default function WorkflowTestPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8 text-indigo-700">
          Legal Agent Workflow Test
        </h1>
        <WorkflowTest />
      </div>
    </div>
  );
}
