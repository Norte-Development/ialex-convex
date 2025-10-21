import { useState, useEffect, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate } from "react-router-dom";
import { Id } from "../../convex/_generated/dataModel";

export type SearchResultType =
  | "case"
  | "client"
  | "document"
  | "escrito"
  | "template"
  | "libraryDocument";

export interface SearchResult {
  _id: Id<any>;
  title?: string;
  name?: string;
  type: SearchResultType;
  // Additional metadata based on type
  metadata?: any;
}

export interface GroupedSearchResults {
  cases: Array<{
    _id: Id<"cases">;
    title: string;
    status: string;
    category?: string;
  }>;
  clients: Array<{
    _id: Id<"clients">;
    name: string;
    clientType: string;
    email?: string;
  }>;
  documents: Array<{
    _id: Id<"documents">;
    title: string;
    caseId: Id<"cases">;
    documentType?: string;
  }>;
  escritos: Array<{
    _id: Id<"escritos">;
    title: string;
    caseId: Id<"cases">;
    status: string;
  }>;
  templates: Array<{
    _id: Id<"modelos">;
    name: string;
    category: string;
    templateType?: string;
  }>;
  libraryDocuments: Array<{
    _id: Id<"libraryDocuments">;
    title: string;
    teamId?: Id<"teams">;
    userId?: Id<"users">;
  }>;
}

export function useGlobalSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Query search results
  const searchResults = useQuery(
    api.functions.search.globalSearch,
    debouncedQuery.trim().length > 0
      ? { query: debouncedQuery, limit: 5 }
      : "skip",
  );

  // Cast the results to the correct type
  const results = searchResults as GroupedSearchResults | undefined;

  const isLoading = results === undefined && debouncedQuery.trim().length > 0;

  // Handle search input change
  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    if (value.trim().length > 0) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setDebouncedQuery("");
    setIsOpen(false);
  }, []);

  // Handle result click and navigation
  const handleResultClick = useCallback(
    (
      type: SearchResultType,
      id: string,
      metadata?: { caseId?: string; teamId?: string; userId?: string },
    ) => {
      clearSearch();

      switch (type) {
        case "case":
          navigate(`/caso/${id}`);
          break;
        case "client":
          // Navigate to clients page (could enhance with a modal later)
          navigate("/clientes");
          break;
        case "document":
          if (metadata?.caseId) {
            navigate(`/caso/${metadata.caseId}/documentos/${id}`);
          }
          break;
        case "escrito":
          if (metadata?.caseId) {
            navigate(`/caso/${metadata.caseId}/escritos/${id}`);
          }
          break;
        case "template":
          // Could open preview modal (reuse existing modal component)
          navigate("/modelos");
          break;
        case "libraryDocument":
          navigate(`/biblioteca/documento/${id}`);
          break;
      }
    },
    [navigate, clearSearch],
  );

  // Check if there are any results
  const hasResults =
    results &&
    (results.cases.length > 0 ||
      results.clients.length > 0 ||
      results.documents.length > 0 ||
      results.escritos.length > 0 ||
      results.templates.length > 0 ||
      results.libraryDocuments.length > 0);

  return {
    searchQuery,
    results,
    isLoading,
    isOpen,
    hasResults,
    handleSearch,
    clearSearch,
    handleResultClick,
    setIsOpen,
  };
}
