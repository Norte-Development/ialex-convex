/**
 * Usage Examples for PaginationControls Component
 * 
 * This file demonstrates different ways to use the generalized PaginationControls component
 * for the pages identified in the todo directory.
 */

import { useState } from "react"
import { PaginationControls } from "./pagination-controls"

// Example 1: Basic Usage (for Clients Page, Teams Page, etc.)
export function BasicPaginationExample() {
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20
  const totalResults = 150
  const totalPages = Math.ceil(totalResults / pageSize)

  return (
    <PaginationControls
      totalResults={totalResults}
      currentPage={currentPage}
      pageSize={pageSize}
      totalPages={totalPages}
      onPageChange={setCurrentPage}
    />
  )
}

// Example 2: With Search (for Cases Page, Events Page, etc.)
export function SearchPaginationExample() {
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20
  const totalResults = 45
  const totalPages = Math.ceil(totalResults / pageSize)
  const searchQuery = "legal case"

  return (
    <PaginationControls
      totalResults={totalResults}
      currentPage={currentPage}
      pageSize={pageSize}
      totalPages={totalPages}
      isSearchMode={true}
      searchQuery={searchQuery}
      onPageChange={setCurrentPage}
    />
  )
}

// Example 3: Custom Configuration (for Models/Templates Page, etc.)
export function CustomPaginationExample() {
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  const totalResults = 200
  const totalPages = Math.ceil(totalResults / pageSize)

  return (
    <PaginationControls
      totalResults={totalResults}
      currentPage={currentPage}
      pageSize={pageSize}
      totalPages={totalPages}
      maxVisiblePages={7}
      showResultsCount={true}
      className="custom-pagination-styles"
      previousLabel="Prev"
      nextLabel="Next"
      resultsLabel="Showing"
      onPageChange={setCurrentPage}
    />
  )
}

// Example 4: Minimal Configuration (for Team Members Table, etc.)
export function MinimalPaginationExample() {
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 15
  const totalResults = 60
  const totalPages = Math.ceil(totalResults / pageSize)

  return (
    <PaginationControls
      totalResults={totalResults}
      currentPage={currentPage}
      pageSize={pageSize}
      totalPages={totalPages}
      showResultsCount={false}
      maxVisiblePages={3}
      onPageChange={setCurrentPage}
    />
  )
}

// Example 5: Integration with Convex Query Results
export function ConvexPaginationExample() {
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20
  
  // This would typically come from a Convex query result
  const mockQueryResult = {
    page: [], // Array of items
    isDone: false,
    continueCursor: null,
    totalCount: 150 // This would be added to the Convex query result
  }

  const totalPages = Math.ceil(mockQueryResult.totalCount / pageSize)

  return (
    <PaginationControls
      totalResults={mockQueryResult.totalCount}
      currentPage={currentPage}
      pageSize={pageSize}
      totalPages={totalPages}
      onPageChange={setCurrentPage}
    />
  )
}

/**
 * Migration Guide for Existing Components:
 * 
 * 1. Replace CasePaginationControls usage:
 *    OLD: <CasePaginationControls {...props} />
 *    NEW: <PaginationControls {...props} />
 * 
 * 2. Replace DataBase PaginationControls usage:
 *    OLD: <PaginationControls page={page} {...props} />
 *    NEW: <PaginationControls currentPage={page} {...props} />
 * 
 * 3. Update imports:
 *    OLD: import { CasePaginationControls } from "./Cases/CasePaginationControls"
 *    NEW: import { PaginationControls } from "@/components/ui"
 */
