import React, { ReactNode } from "react";
import { useLayout } from "@/context/LayoutContext";
import NavBar from "./NavBar";
import Sidebar from "./Sidebar";

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isSidebarOpen } = useLayout();

  return (
    <div className="flex h-screen bg-background">
      <div className="flex-1 flex flex-col overflow-hidden">
        <NavBar />
        <div className="flex">
          <Sidebar />
          <main
            className={`flex-1 overflow-x-hidden overflow-y-auto bg-background   pt-20 transition-all duration-300 ease-in-out  ${
              isSidebarOpen ? "mr-80" : "mr-0 ml-0"
            }`}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
