import { useLocation } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Home } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

export default function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);

  const caseId = pathnames[0] === "caso" && pathnames[1] ? pathnames[1] : null;
  const casesResult = useQuery(api.functions.cases.getCase, {
    caseId: caseId as Id<"cases">,
  });
  const currentCase = caseId ? casesResult : null;

  // Detectar si estamos en la ruta de un escrito
  const escritoId =
    pathnames[0] === "caso" && pathnames[2] === "escritos" && pathnames[3]
      ? pathnames[3]
      : null;
  const escritoResult = useQuery(
    api.functions.documents.getEscrito,
    escritoId ? { escritoId: escritoId as Id<"escritos"> } : "skip",
  );
  const currentEscrito = escritoId ? escritoResult : null;

  // Detectar si estamos en la ruta de un documento
  const documentId =
    pathnames[0] === "caso" && pathnames[2] === "documentos" && pathnames[3]
      ? pathnames[3]
      : null;
  const documentResult = useQuery(
    api.functions.documents.getDocument,
    documentId ? { documentId: documentId as Id<"documents"> } : "skip",
  );
  const currentDocument = documentId ? documentResult : null;

  if (pathnames.length === 0) return null;

  const formatBreadcrumb = (str: string, index: number) => {
    // Mostrar título del caso
    if (pathnames[0] === "caso" && index === 1 && currentCase) {
      return currentCase?.title || "";
    }

    // Mostrar título del escrito
    if (
      pathnames[0] === "caso" &&
      pathnames[2] === "escritos" &&
      index === 3 &&
      currentEscrito
    ) {
      return currentEscrito?.title || "";
    }

    // Mostrar nombre del documento
    if (
      pathnames[0] === "caso" &&
      pathnames[2] === "documentos" &&
      index === 3 &&
      currentDocument
    ) {
      return currentDocument?.title || "";
    }

    const decoded = decodeURIComponent(str);
    return decoded
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getLinkPath = (index: number) => {
    let path = `/${pathnames.slice(0, index + 1).join("/")}`;
    if (path === "/caso") {
      return "/casos";
    }
    return path;
  };

  return (
    <Breadcrumb className="flex items-center gap-2 text-[18px] min-w-0 max-w-full overflow-hidden">
      <BreadcrumbList>
        <BreadcrumbItem key="home">
          <Link to="/" className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            <BreadcrumbSeparator className="flex-shrink-0" />
          </Link>
        </BreadcrumbItem>
        {pathnames.map((value, index) => {
          const isLast = index === pathnames.length - 1;
          const to = getLinkPath(index);
          let displayName = formatBreadcrumb(value, index);

          if (value === "caso") {
            displayName = "Casos";
          }

          return isLast ? (
            <BreadcrumbItem key={to}>
              <span
                className="truncate min-w-0 max-w-[200px] block"
                title={displayName}
              >
                {displayName}
              </span>
            </BreadcrumbItem>
          ) : (
            <React.Fragment key={to}>
              <BreadcrumbItem>
                <Link
                  to={to}
                  className="hover:underline truncate min-w-0 max-w-[200px] block"
                  title={displayName}
                >
                  {displayName}
                </Link>
                <BreadcrumbSeparator className="flex-shrink-0" />
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
