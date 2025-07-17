import React, { ReactNode } from "react";
import { useLayout } from "@/context/LayoutContext";
import { useLocation } from "react-router-dom";
import Layout from "./Layout";
import CaseDetailLayout from "./CaseDetailLayout";

interface ConditionalLayoutProps {
  children: ReactNode;
  forceLayout?: "case" | "normal";
}

const ConditionalLayout: React.FC<ConditionalLayoutProps> = ({
  children,
  forceLayout,
}) => {
  const { isInCaseContext } = useLayout();
  const location = useLocation();

  const shouldUseCaseLayout = () => {
    if (forceLayout) {
      return forceLayout === "case";
    }

    if (location.pathname.includes("/caso/")) {
      return true;
    }
    const caseContextPages = ["/clientes", "/modelos", "/base-de-datos"];
    const isInCaseContextPage = caseContextPages.some(
      (page) => location.pathname === page,
    );

    return isInCaseContext && isInCaseContextPage;
  };

  if (shouldUseCaseLayout()) {
    return <CaseDetailLayout>{children}</CaseDetailLayout>;
  }

  return <Layout>{children}</Layout>;
};

export default ConditionalLayout;
