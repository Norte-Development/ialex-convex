import React, { ReactNode } from "react";
import { useLayout } from "@/context/LayoutContext";
import NavBar from "./Navbar/NavBar";
import Sidebar from "./Sidebar";

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="flex-1 flex flex-col overflow-hidden">
        <NavBar />
        <CopilotSidebar
          defaultOpen={false}
          clickOutsideToClose={false}
          hitEscapeToClose={true}
          shortcut="k"
          labels={{
            title: "Alex",
            initial: "¿En que trabajamos hoy?"
          }}
        >
          <div className="flex w-full">
            <main
              className="flex-1 h-full overflow-x-hidden w-full overflow-y-auto bg-background transition-all duration-300 ease-in-out"
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
