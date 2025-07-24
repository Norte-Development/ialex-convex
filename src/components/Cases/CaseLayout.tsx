import { CopilotSidebar } from "@copilotkit/react-ui";
import { api } from "../../../convex/_generated/api";
import { useMutation } from "convex/react";
import CaseSidebar from "./CaseSideBar";
import { useLayout } from "@/context/LayoutContext";
import { useCase } from "@/context/CaseContext";
import { useThread } from "@/context/ThreadContext";

interface CaseDetailLayoutProps {
  children: React.ReactNode;
}

export default function CaseLayout({ children }: CaseDetailLayoutProps) {
  const { isCaseSidebarOpen } = useLayout();
  const { caseId } = useCase();
  const { thread } = useThread();
  const createThread = useMutation(api.functions.chat.createThreadMetadata);


  const onSubmitMessageCallback = (message: string) => {

    const truncatedMessage = message.slice(0, 50);

    createThread({
        caseId: caseId || undefined,
        title: truncatedMessage,
        threadId: thread.threadId,
      });

    return Promise.resolve();
  }


  return (
    <>
    <CopilotSidebar
          defaultOpen={true}
          clickOutsideToClose={false}
          hitEscapeToClose={true}
          shortcut="k"
          labels={{
            title: "Alex",
            initial: "¿En que trabajamos hoy?"
          }}
          onSubmitMessage={onSubmitMessageCallback}
        >
    <div className="flex w-full h-screen pt-14">
      <CaseSidebar />
      <section
        className={`w-full h-full flex justify-center items-center overflow-y-auto bg-[#f7f7f7] transition-all duration-300 ease-in-out ${
          isCaseSidebarOpen ? "ml-64" : "ml-0"}`}
      >
        {children}
      </section>
    </div>
    </CopilotSidebar>
    </>
  );
}
