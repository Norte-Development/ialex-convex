import type { NormalizedCaseCandidate } from "../types/api";

export function normalizeFreForComparison(fre: string): string {
  return fre
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function normalizeCaseNumberForMatching(caseNumber: string, year: number): string {
  const parts = caseNumber.split("/");
  if (parts.length > 0) {
    const numericPart = parts[0].replace(/^0+/, "") || "0";
    const yearPart = parts[1] || String(year);
    return `${numericPart}/${yearPart}`;
  }
  return caseNumber;
}

function candidateMatches(
  candidate: NormalizedCaseCandidate,
  searchJurisdiction: string,
  searchCaseNumber: string,
  searchYear: number,
): boolean {
  if (
    !candidate.jurisdiction ||
    candidate.jurisdiction.toUpperCase() !== searchJurisdiction.toUpperCase()
  ) {
    return false;
  }

  if (!candidate.caseNumber) {
    return false;
  }

  const normalizedCandidate = normalizeCaseNumberForMatching(
    candidate.caseNumber,
    searchYear,
  );
  const normalizedSearch = normalizeCaseNumberForMatching(
    `${searchCaseNumber}/${searchYear}`,
    searchYear,
  );

  const candidateBase = normalizedCandidate.split("/").slice(0, 2).join("/");
  const searchBase = normalizedSearch.split("/").slice(0, 2).join("/");

  return candidateBase === searchBase;
}

export type CandidateSelectionResult = {
  selectedCandidate: NormalizedCaseCandidate | null;
  exactFreMatchesCount: number;
  baseMatchesCount: number;
};

export function selectCaseHistoryCandidate(args: {
  targetFre: string;
  candidates: NormalizedCaseCandidate[];
  jurisdiction: string;
  caseNumber: string;
  year: number;
}): CandidateSelectionResult {
  const targetNormalized = normalizeFreForComparison(args.targetFre);

  const exactFreMatches = args.candidates.filter(
    (candidate) =>
      normalizeFreForComparison(candidate.fre) === targetNormalized,
  );
  if (exactFreMatches.length === 1) {
    return {
      selectedCandidate: exactFreMatches[0],
      exactFreMatchesCount: exactFreMatches.length,
      baseMatchesCount: 0,
    };
  }

  if (exactFreMatches.length > 1) {
    return {
      selectedCandidate: null,
      exactFreMatchesCount: exactFreMatches.length,
      baseMatchesCount: 0,
    };
  }

  const baseMatches = args.candidates.filter((candidate) =>
    candidateMatches(candidate, args.jurisdiction, args.caseNumber, args.year),
  );

  if (baseMatches.length === 1) {
    return {
      selectedCandidate: baseMatches[0],
      exactFreMatchesCount: 0,
      baseMatchesCount: baseMatches.length,
    };
  }

  // No matches or ambiguous matches: do not auto-select.
  return {
    selectedCandidate: null,
    exactFreMatchesCount: 0,
    baseMatchesCount: baseMatches.length,
  };
}

