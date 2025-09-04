import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";

export interface PageState {
  currentPage: string;
  currentView: string;
  selectedItems: string[];
  searchQuery: string;
  filters: Record<string, any>;
  lastUpdated: number;
}

export interface PageContextType {
  pageState: PageState;
  updatePage: (updates: Partial<PageState>) => void;
  addSelectedItem: (itemId: string) => void;
  removeSelectedItem: (itemId: string) => void;
  clearSelectedItems: () => void;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Record<string, any>) => void;
  setCurrentView: (view: string) => void;
}

const PageContext = createContext<PageContextType | undefined>(undefined);

interface PageProviderProps {
  children: ReactNode;
}

export const PageProvider: React.FC<PageProviderProps> = ({ children }) => {
  const location = useLocation();

  const [pageState, setPageState] = useState<PageState>({
    currentPage: '',
    currentView: 'list',
    selectedItems: [],
    searchQuery: '',
    filters: {},
    lastUpdated: Date.now(),
  });

  // Update current page when location changes
  useEffect(() => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    let currentPage = 'home';

    if (pathSegments.length > 0) {
      const firstSegment = pathSegments[0];

      // Map URL segments to meaningful page names
      switch (firstSegment) {
        case 'cases':
          currentPage = pathSegments.length > 1 ? 'case-detail' : 'cases';
          break;
        case 'clients':
          currentPage = 'clients';
          break;
        case 'documents':
          currentPage = 'documents';
          break;
        case 'escritos':
          currentPage = 'escritos';
          break;
        case 'data-base':
          currentPage = 'database';
          break;
        case 'models':
          currentPage = 'models';
          break;
        case 'teams':
          currentPage = 'teams';
          break;
        case 'settings':
          currentPage = 'settings';
          break;
        default:
          currentPage = firstSegment;
      }
    }

    updatePage({ currentPage, lastUpdated: Date.now() });
  }, [location.pathname]);

  const updatePage = useCallback((updates: Partial<PageState>) => {
    setPageState(prev => ({
      ...prev,
      ...updates,
      lastUpdated: Date.now(),
    }));
  }, []);

  const addSelectedItem = useCallback((itemId: string) => {
    setPageState(prev => ({
      ...prev,
      selectedItems: [...prev.selectedItems, itemId],
      lastUpdated: Date.now(),
    }));
  }, []);

  const removeSelectedItem = useCallback((itemId: string) => {
    setPageState(prev => ({
      ...prev,
      selectedItems: prev.selectedItems.filter(id => id !== itemId),
      lastUpdated: Date.now(),
    }));
  }, []);

  const clearSelectedItems = useCallback(() => {
    setPageState(prev => ({
      ...prev,
      selectedItems: [],
      lastUpdated: Date.now(),
    }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setPageState(prev => ({
      ...prev,
      searchQuery: query,
      lastUpdated: Date.now(),
    }));
  }, []);

  const setFilters = useCallback((filters: Record<string, any>) => {
    setPageState(prev => ({
      ...prev,
      filters,
      lastUpdated: Date.now(),
    }));
  }, []);

  const setCurrentView = useCallback((view: string) => {
    setPageState(prev => ({
      ...prev,
      currentView: view,
      lastUpdated: Date.now(),
    }));
  }, []);

  const value: PageContextType = {
    pageState,
    updatePage,
    addSelectedItem,
    removeSelectedItem,
    clearSelectedItems,
    setSearchQuery,
    setFilters,
    setCurrentView,
  };

  return (
    <PageContext.Provider value={value}>
      {children}
    </PageContext.Provider>
  );
};

export const usePage = () => {
  const context = useContext(PageContext);
  if (context === undefined) {
    throw new Error("usePage must be used within a PageProvider");
  }
  return context;
};
