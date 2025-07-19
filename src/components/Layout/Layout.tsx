import React, { ReactNode } from "react";
// import { useLayout } from "@/context/LayoutContext";
import NavBar from "./NavBar";
// import Sidebar from "./Sidebar";
import { CopilotSidebar } from "@copilotkit/react-ui";

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  // const { isSidebarOpen } = useLayout();

  return (
    <div className="flex h-screen bg-background">
      <div className="flex-1 flex flex-col overflow-hidden">
        <NavBar />
        <CopilotSidebar
          defaultOpen={false}
          labels={{
            title: "Alex",
            initial: "¿En que trabajamos hoy?"
          }}
          >
            <div className="flex">
          
              <main
              className={`flex-1 overflow-x-hidden overflow-y-auto bg-background   transition-all duration-300 ease-in-out mr-0 ml-0 w-full  `}
              // isSidebarOpen ? "mr-80" : "mr-0 ml-0"}`}
              >
                {children}
              </main>
            </div>
          </CopilotSidebar>
      </div>
    </div>
  );
};

export default Layout;
