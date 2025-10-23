import { useLocation } from "react-router-dom";
import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

export default function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);

  const caseId = pathnames[0] === "caso" && pathnames[1] ? pathnames[1] : null;
  const casesResult = useQuery(api.functions.cases.getCases, {});
  const cases = casesResult || [];
  const currentCase = caseId ? cases.find((c) => c._id === caseId) : null;

  const escritoId =
    pathnames[0] === "caso" && pathnames[2] === "escritos" && pathnames[3]
      ? pathnames[3]
      : null;
  const escrito = useQuery(
    api.functions.documents.getEscrito,
    escritoId ? { escritoId: escritoId as Id<"escritos"> } : "skip",
  );

  if (pathnames.length === 0) return null;

  const formatBreadcrumb = (str: string, index: number) => {
    // Mostrar título del caso
    if (pathnames[0] === "caso" && index === 1 && currentCase) {
      return currentCase.title;
    }

    // Mostrar título del escrito
    if (
      pathnames[0] === "caso" &&
      pathnames[2] === "escritos" &&
      index === 3 &&
      escrito
    ) {
      return escrito.title;
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
    <div className="flex items-center gap-2 text-[18px]">
      {pathnames.map((value, index) => {
        const isLast = index === pathnames.length - 1;
        const to = getLinkPath(index);
        let displayName = formatBreadcrumb(value, index);

        if (value === "caso") {
          displayName = "Casos";
        }

        return isLast ? (
          <span key={to}>{displayName}</span>
        ) : (
          <React.Fragment key={to}>
            <Link to={to} className="hover:underline">
              {displayName}
            </Link>
            <span>/</span>
          </React.Fragment>
        );
      })}
    </div>
  );
}
