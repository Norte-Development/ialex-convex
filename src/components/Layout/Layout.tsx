import React, { ReactNode } from "react";
import NavBar from "./Navbar/NavBar";

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className=" flex flex-col overflow-hidden">
      <NavBar />
      <div className="flex w-full">
        <main className="flex-1 h-full overflow-x-hidden w-full overflow-y-auto bg-background transition-all duration-300 ease-in-out">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
