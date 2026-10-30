import { describe, it, expect } from "vitest";
import seed from "../research/seed.json";
import {
  capabilityEvidence,
  evidenceCounts,
  csv,
  duplicates,
  emptyFilters,
  filterPapers,
  importCSV,
  normalizeDOI,
  parseResearch,
  screeningState,
  subset,
  latestCoding,
} from "../research/service";
import { emptyCoding, type Paper, type ResearchDataset } from "../research/model";
const fixture = () => parseResearch(JSON.stringify(seed));
const rejected = (fn: (d: ResearchDataset) => void) => {
  const d = fixture();
  fn(d);
  expect(() => parseResearch(JSON.stringify(d))).toThrow();
};
describe("Research dataset schema and isolation", () => {
  it("loads the expanded catalog without inventing primary-study inclusion decisions", () => {
    const d = fixture();
    expect(d.papers.map((p) => p.id)).toEqual(expect.arrayContaining([
      "knitui", "hester-hofmann-machine-knit-review", "hester-review-ref-132",
    ]));
    expect(d.screening).toEqual([expect.objectContaining({
      paperId: "hester-hofmann-machine-knit-review",
      reviewStage: "full_text", decision: "maybe",
    })]);
    expect(screeningState(d, "hester-hofmann-machine-knit-review")).toBe("Maybe");
    expect(d.papers.filter((p) => p.id !== "hester-hofmann-machine-knit-review")
      .every((p) => screeningState(d, p.id) === "Candidate")).toBe(true);
    expect(d.materialReferences).toHaveLength(1);
    expect(d.papers.some((p) => p.id === "fashionary")).toBe(false);
  });
  it("preserves a full backup round trip", () => {
    const d = fixture();
    expect(parseResearch(JSON.stringify(d))).toEqual(d);
  });
  it("rejects future schema, malformed objects, IDs, enums and references", () => {
    expect(() => parseResearch("{")).toThrow();
    rejected((d) => {
      (d as any).schemaVersion = 2;
    });
    rejected((d) => {
      d.papers.push(d.papers[0]);
    });
    rejected((d) => {
      (d.papers[0] as any).publicationType = "fiction";
    });
    rejected((d) => {
      d.coding[0].paperId = "missing";
    });
    rejected((d) => {
      d.requirements[0].supportingPaperIds = ["missing"];
    });
    rejected((d) => {
      d.coding[0].fabricationMethods = ["magic"];
    });
  });
  it("rejects unsafe URLs, unsupported verification and missing evidence", () => {
    rejected((d) => {
      d.papers[0].canonicalUrl = "javascript:alert(1)";
    });
    rejected((d) => {
      d.papers[0].verifiedAgainst = [];
    });
    rejected((d) => {
      d.coding[0].claims[0].locator = "";
    });
    rejected((d) => {
      d.coding[0].claims[0].sourceUrl = "data:text/html,hi";
    });
  });
  it("rejects impossible dates, invalid counts and reversed windows", () => {
    rejected((d) => {
      d.searchWindow.from = "2026-02-30";
    });
    rejected((d) => {
      d.searchWindow.from = "2030-01-01";
    });
    rejected((d) => {
      d.searchRuns[0].resultCount = -1;
    });
  });
});
describe("Research search and evidence", () => {
  it("searches title, authors, notes, and topics with zero-result handling", () => {
    const d = fixture();
    for (const q of ["KnitUI", "Wojciech", "DOI suffix", "Clinical co-design"])
      expect(
        filterPapers(d, { ...emptyFilters, query: q }).length,
      ).toBeGreaterThan(0);
    expect(
      filterPapers(d, { ...emptyFilters, query: "no-such-term-xxx" }),
    ).toEqual([]);
  });
  it("combines date, type, verification, roles and coding filters", () => {
    // Controlled records isolate filter behavior from additions to the live catalog.
    const d = fixture();
    const paper = (id: string, patch: Partial<Paper> = {}): Paper => ({
      ...d.papers[0], id, title: id, year: 2024,
      publicationType: "journal", verificationStatus: "verified", ...patch,
    });
    d.papers = [
      paper("match"), paper("older", {year: 2023}),
      paper("conference", {publicationType: "conference"}),
      paper("unverified", {verificationStatus: "needs_verification"}),
      paper("unknown-year", {year: null}), paper("future", {year: 2027}),
      paper("uncoded"),
    ];
    d.coding = [
      {...emptyCoding("match", "reviewer"), targetRoles: ["clinician"], fabricationMethods: ["weave"]},
      {...emptyCoding("older", "reviewer"), targetRoles: ["clinician"], fabricationMethods: ["knit"]},
    ];
    const ids = (filters: Partial<typeof emptyFilters>) =>
      filterPapers(d, {...emptyFilters, ...filters}).map((p) => p.id);
    expect(ids({yearFrom: "2024", yearTo: "2026", publicationType: "journal",
      verificationStatus: "verified"})).toEqual(["match", "uncoded"]);
    expect(ids({targetRoles: "clinician"})).toEqual(["match", "older"]);
    expect(ids({fabricationMethods: "weave"})).toEqual(["match"]);
    expect(ids({yearFrom: "2024", targetRoles: "clinician", fabricationMethods: "weave"})).toEqual(["match"]);
    expect(ids({yearTo: "2026"})).toEqual(["conference", "match", "older", "uncoded", "unverified"]);
  });

  it("sorts unknown years after known years", () => {
    const d = fixture();
    const p = filterPapers(d, emptyFilters, "year");
    expect(p[0].year).toBe(2026);
    expect(p.at(-1)?.year).toBeNull();
  });
  it("does not infer absence or rights from no code", () => {
    const d = fixture();
    expect(capabilityEvidence(d, "luxknit", "placement")).toEqual([]);
    expect(capabilityEvidence(d, "knitui", "placement")).toHaveLength(1);
    expect(latestCoding(d, "knitui")[0].designRights).toEqual([]);
  });
  it("keeps hypotheses and interpretations distinct from reported observations", () => {
    const d = fixture(),
      c = d.coding[0];
    c.claims.push(
      { ...c.claims[0], evidenceLevel: "hypothesis" },
      { ...c.claims[0], evidenceLevel: "interpretation" },
    );
    expect(
      evidenceCounts(capabilityEvidence(d, c.paperId, "placement")),
    ).toEqual({ reported: 1, interpretation: 1, hypothesis: 1 });
  });
  it("uses latest revision per reviewer without deleting earlier evidence", () => {
    const d = fixture(),
      a = d.coding[0];
    d.coding.push({ ...a, id: "second", claims: [] });
    expect(capabilityEvidence(d, a.paperId, "placement")).toHaveLength(0);
    d.coding.push({ ...a, id: "third", reviewerId: "reviewer-b" });
    expect(capabilityEvidence(d, a.paperId, "placement")).toHaveLength(1);
    expect(d.coding.filter((c) => c.paperId === a.paperId)).toHaveLength(3);
  });
  it("retains awaiting-full-text state during pending full-text review and respects dedup exclusions", () => {
    const d = fixture();
    const rec = {
      id: "ta",
      paperId: "knitui",
      reviewerId: "reviewer",
      reviewStage: "title_abstract" as const,
      decision: "include" as const,
      decisionDate: "2026-10-29",
      comment: "",
    };
    d.screening.push(rec, {
      ...rec,
      id: "ft",
      reviewStage: "full_text",
      decision: "pending",
    });
    expect(screeningState(d, "knitui")).toBe("Awaiting full text");
    d.screening.push({
      ...rec,
      id: "dedup",
      paperId: "luxknit",
      reviewStage: "dedup",
      decision: "exclude",
      reasonCode: "duplicate_version",
    });
    expect(screeningState(d, "luxknit")).toBe("Excluded");
  });
  it("keeps independent screening decisions and exposes disagreements", () => {
    const d = fixture();
    const rec = {
      id: "a",
      paperId: "knitui",
      reviewerId: "a",
      reviewStage: "title_abstract" as const,
      decision: "include" as const,
      decisionDate: "2026-10-28",
      comment: "",
    };
    d.screening.push(rec);
    expect(screeningState(d, "knitui")).toBe("Awaiting full text");
    d.screening.push({
      ...rec,
      id: "b",
      reviewerId: "b",
      decision: "exclude",
      reasonCode: "out_of_scope",
    });
    expect(screeningState(d, "knitui")).toBe("Disagreement");
    d.screening.push({ ...rec, id: "c", reviewStage: "full_text" });
    expect(screeningState(d, "knitui")).toBe("Disagreement");
    d.screening.push({
      ...rec,
      id: "d",
      reviewerId: "b",
      reviewStage: "full_text",
    });
    expect(screeningState(d, "knitui")).toBe("Included");
    expect(d.screening.filter((s) => s.paperId === "knitui")).toHaveLength(4);
    expect(d.screening.filter((s) => s.paperId !== "knitui")).toEqual(seed.screening);
    expect(() => parseResearch(JSON.stringify(d))).not.toThrow();
  });
});
describe("Research import, deduplication and exports", () => {
  it("normalizes DOI and suggests rather than merges duplicates", () => {
    const d = fixture(),
      p = d.papers[0];
    expect(normalizeDOI("HTTPS://doi.org/10.1145/ABC")).toBe("10.1145/abc");
    const papers = [
      p,
      { ...p, id: "another", doi: "https://doi.org/" + p.doi?.toUpperCase() },
    ];
    expect(duplicates(papers)[0].reason).toContain("DOI");
    expect(papers).toHaveLength(2);
    expect(
      duplicates([p, { ...p, id: "title", doi: undefined }])[0].reason,
    ).toContain("title");
  });
  it("exports filtered JSON with valid references and CSV with quoted fields", () => {
    const d = fixture(),
      p = d.papers[0];
    const sub = subset(d, [p]);
    expect(parseResearch(JSON.stringify(sub)).papers).toHaveLength(1);
    const text = csv([
      { ...p, title: 'A "quoted", title\nline', notes: '=HYPERLINK("x")' },
    ]);
    expect(text).toContain('"A ""quoted"", title\nline"');
    expect(text).toContain("\"'=HYPERLINK");
    expect(csv([]).split("\r\n")).toHaveLength(1);
  });
  it("imports quoted CSV candidates and reports per-row errors", () => {
    const r = importCSV(
      'title,authors,year,doi\r\n"A, title","One; Two",2024,10.1234/test\r\nBad,,oops,\r\n"Multiline\nTitle",,,',
    );
    expect(r.papers).toHaveLength(2);
    expect(r.errors).toHaveLength(1);
    expect(r.papers[0].authors).toEqual(["One", "Two"]);
    expect(r.papers[0].verificationStatus).toBe("needs_verification");
    expect(r.papers[1].title).toContain("\n");
    expect(() => importCSV("foo\nx")).toThrow();
    expect(() => importCSV('title\n"oops')).toThrow();
  });
  it("requires an exclusion reason and permits independent blank coding", () => {
    const d = fixture();
    d.coding.push(emptyCoding("knitui", "reviewer"));
    expect(() => parseResearch(JSON.stringify(d))).not.toThrow();
    d.screening.push({
      id: "x",
      paperId: "knitui",
      reviewerId: "reviewer",
      reviewStage: "full_text",
      decision: "exclude",
      decisionDate: "2026-10-28",
      comment: "",
    });
    expect(() => parseResearch(JSON.stringify(d))).toThrow(/reason/);
  });
});
