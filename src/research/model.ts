export const codebook = {
  fabricationMethods: [
    "knit",
    "weave",
    "embroider",
    "print",
    "hybrid",
    "other",
  ],
  sensorModalities: [
    "resistive",
    "piezoresistive",
    "capacitive",
    "bioelectric",
    "pressure",
    "strain",
    "other",
  ],
  representations: [
    "fabric_surface",
    "stitch_grid",
    "loop_graph",
    "circuit_graph",
    "body_map",
    "fabrication_program",
    "other",
  ],
  authoringCapabilities: [
    "placement",
    "geometry",
    "material_selection",
    "trace_routing",
    "electrode_layout",
    "topology",
    "structure_editing",
    "simulation",
    "export",
    "other",
  ],
  targetRoles: [
    "clinician",
    "patient",
    "designer",
    "textile_engineer",
    "electronics_engineer",
    "maker",
    "researcher",
    "other",
  ],
  evaluationMethods: [
    "technical_bench",
    "usability",
    "co_design",
    "field_study",
    "clinical",
    "none_reported",
    "other",
  ],
} as const;
export type CodingField = keyof typeof codebook;
export type Paper = {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  publicationType:
    "journal" | "conference" | "preprint" | "project_page" | "other";
  doi?: string;
  canonicalUrl?: string;
  openAccessUrl?: string;
  abstract?: string;
  keywords: string[];
  topics: string[];
  verificationStatus:
    "verified" | "partially_verified" | "needs_verification" | "unresolved";
  verifiedAgainst: { url: string; checkDate: string; fields: string[] }[];
  provenance:
    "seed" | "database_search" | "citation_chaining" | "manual_import";
  dateAdded: string;
  updatedAt: string;
  notes: string;
};
export type ScreeningRecord = {
  id: string;
  paperId: string;
  reviewStage: "dedup" | "title_abstract" | "full_text";
  decision: "pending" | "include" | "exclude" | "maybe";
  reasonCode?: string;
  reviewerId: string;
  decisionDate: string;
  comment: string;
};
export type Claim = {
  text: string;
  evidenceLevel: "directly_reported" | "interpretation" | "hypothesis";
  locator: string;
  sourceUrl: string;
  capability?: (typeof codebook.authoringCapabilities)[number];
};
export type CodingRecord = {
  id: string;
  paperId: string;
  reviewerId: string;
  codebookVersion: string;
  status: "uncoded" | "in_progress" | "coded" | "reconciled";
  fabricationMethods: string[];
  sensorModalities: string[];
  representations: string[];
  authoringCapabilities: string[];
  targetRoles: string[];
  evaluationMethods: string[];
  fabricationMaturity:
    | "concept"
    | "visual_preview"
    | "fabrication_export"
    | "fabricated"
    | "bench_validated"
    | "clinical_evaluated"
    | "unknown";
  designRights: {
    role: string;
    decisionType: string;
    permission: "propose" | "edit" | "approve" | "validate" | "not_reported";
    evidenceNote: string;
    locator: string;
    sourceUrl: string;
  }[];
  claims: Claim[];
  limitations: string[];
  relevanceToStudio: string;
  proposedFeatureIds: string[];
  updatedAt: string;
};
export type FeatureRequirement = {
  id: string;
  name: string;
  description: string;
  targetRole: string;
  cadModule: string;
  status: "proposed" | "planned" | "implemented" | "tested" | "deferred";
  supportingPaperIds: string[];
  counterexamplePaperIds: string[];
  evidenceSummary: string;
  assumptions: string[];
  verificationNeeded: string[];
  acceptanceCriteria: string[];
};
export type SearchRun = {
  id: string;
  sourceDatabase: string;
  exactQuery: string;
  queryDate: string;
  searchWindow: { from: string; to: string };
  resultCount?: number;
  importedCount?: number;
  notes: string;
};
export type MaterialReference = {
  id: string;
  name: string;
  type: string;
  sourceUrl: string;
  attribution: string;
  reuseNotes: string;
  verificationStatus: string;
  associatedPaperIds: string[];
};
export type ResearchDataset = {
  schemaVersion: 1;
  protocolVersion: string;
  searchWindow: { from: string; to: string };
  papers: Paper[];
  screening: ScreeningRecord[];
  coding: CodingRecord[];
  requirements: FeatureRequirement[];
  searchRuns: SearchRun[];
  materialReferences: MaterialReference[];
};
export const today = () => new Date().toISOString().slice(0, 10);
export const label = (s: string) =>
  s.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
export const emptyCoding = (
  paperId: string,
  reviewerId: string,
): CodingRecord => ({
  id: crypto.randomUUID(),
  paperId,
  reviewerId,
  codebookVersion: "1.0",
  status: "in_progress",
  fabricationMethods: [],
  sensorModalities: [],
  representations: [],
  authoringCapabilities: [],
  targetRoles: [],
  evaluationMethods: [],
  fabricationMaturity: "unknown",
  designRights: [],
  claims: [],
  limitations: [],
  relevanceToStudio: "",
  proposedFeatureIds: [],
  updatedAt: today(),
});
