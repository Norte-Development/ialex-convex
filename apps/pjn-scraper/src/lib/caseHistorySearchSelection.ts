import type { NormalizedCaseCandidate } from "../types/api";

export function normalizeFreForComparison(fre: string): string {
  const cleaned = fre
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

  // Normalize expediente numbers like "FRE-007767/2025" or "FRE 0007767/2025/TO2"
  // so that leading zeros in the numeric part don't affect comparisons.
  const match = cleaned.match(/^([A-Z]+)[\s-]+(0*\d+)\/(\d{4})(.*)$/);
  if (!match) {
    // Fallback to the simple normalization when the format is unexpected
    return cleaned;
  }

  const jurisdiction = match[1];
  const numericPart = match[2].replace(/^0+/, "") || "0";
  const year = match[3];
  const suffix = match[4] || "";

  // Canonical form: JUR-<number-without-leading-zeros>/<year><suffix>
  return `${jurisdiction}-${numericPart}/${year}${suffix}`;
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

