import {
  codebook,
  type Paper,
  type ResearchDataset,
  type CodingRecord,
} from "./model";
const choices = {
  publicationType: [
    "journal",
    "conference",
    "preprint",
    "project_page",
    "other",
  ],
  verificationStatus: [
    "verified",
    "partially_verified",
    "needs_verification",
    "unresolved",
  ],
  provenance: ["seed", "database_search", "citation_chaining", "manual_import"],
  reviewStage: ["dedup", "title_abstract", "full_text"],
  decision: ["pending", "include", "exclude", "maybe"],
  status: ["uncoded", "in_progress", "coded", "reconciled"],
  fabricationMaturity: [
    "concept",
    "visual_preview",
    "fabrication_export",
    "fabricated",
    "bench_validated",
    "clinical_evaluated",
    "unknown",
  ],
};
export const normalizeDOI = (s = "") =>
  s
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/, "");
export const validDOI = (s: string) => /^10\.\d{4,9}\/\S+$/i.test(s);
function fail(path: string, msg: string): never {
  throw Error(`${path}: ${msg}`);
}
function obj(x: unknown, p: string): Record<string, any> {
  if (!x || typeof x !== "object" || Array.isArray(x))
    fail(p, "expected object");
  return x as Record<string, any>;
}
function str(x: unknown, p: string) {
  if (typeof x !== "string" || x.length > 30000)
    fail(p, "expected text (max 30,000 characters)");
}
function textFields(o: Record<string, any>, ks: string[], p: string) {
  ks.forEach((k) => str(o[k], `${p}.${k}`));
}
function arr(x: unknown, p: string): any[] {
  if (!Array.isArray(x) || x.length > 5000)
    fail(p, "expected array (max 5,000 items)");
  return x;
}
function strings(x: unknown, p: string, allowed?: readonly string[]) {
  arr(x, p).forEach((v, i) => {
    str(v, `${p}[${i}]`);
    if (allowed && !allowed.includes(v)) fail(p, `unknown code ${v}`);
  });
}
function en(x: unknown, values: readonly string[], p: string) {
  if (typeof x !== "string" || !values.includes(x)) fail(p, "unknown value");
}
function date(x: unknown, p: string) {
  str(x, p);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(x as string) ||
    Number.isNaN(Date.parse(x as string)) ||
    new Date(x as string).toISOString().slice(0, 10) !== x
  )
    fail(p, "expected valid YYYY-MM-DD date");
}
function url(x: unknown, p: string) {
  str(x, p);
  try {
    const u = new URL(x as string);
    if (!["https:", "http:"].includes(u.protocol) || u.username || u.password)
      fail(p, "expected public HTTP(S) URL");
  } catch {
    fail(p, "expected HTTP(S) URL");
  }
}
function windowCheck(x: unknown, p: string) {
  const w = obj(x, p);
  date(w.from, p + ".from");
  date(w.to, p + ".to");
  if (w.from > w.to) fail(p, "start must precede end");
}
export function validatePaper(x: unknown, path = "paper"): Paper {
  const p = obj(x, path);
  textFields(p, ["id", "title", "dateAdded", "updatedAt", "notes"], path);
  if (!p.id.trim() || !p.title.trim()) fail(path, "ID and title required");
  for (const k of ["authors", "keywords", "topics"])
    strings(p[k], path + "." + k);
  if (
    p.year !== null &&
    (!Number.isInteger(p.year) || p.year < 1800 || p.year > 2200)
  )
    fail(path + ".year", "expected year or null");
  if (p.venue !== null) str(p.venue, path + ".venue");
  for (const k of [
    "publicationType",
    "verificationStatus",
    "provenance",
  ] as const)
    en(p[k], choices[k], path + "." + k);
  if (p.doi !== undefined && !validDOI(p.doi))
    fail(path + ".doi", "invalid DOI");
  for (const k of ["canonicalUrl", "openAccessUrl"])
    if (p[k] !== undefined) url(p[k], path + "." + k);
  if (p.abstract !== undefined) str(p.abstract, path + ".abstract");
  date(p.dateAdded, path + ".dateAdded");
  date(p.updatedAt, path + ".updatedAt");
  arr(p.verifiedAgainst, path + ".verifiedAgainst").forEach((v, i) => {
    const q = obj(v, path);
    url(q.url, path + `.verifiedAgainst[${i}].url`);
    date(q.checkDate, path + ".checkDate");
    strings(q.fields, path + ".fields");
  });
  if (
    ["verified", "partially_verified"].includes(p.verificationStatus) &&
    !p.verifiedAgainst.length
  )
    fail(path, "verified records require provenance");
  if (
    p.verificationStatus === "verified" &&
    (!p.authors.length || p.year === null || p.venue === null)
  )
    fail(
      path,
      "complete verified bibliography requires authors, year and venue",
    );
  return p as Paper;
}
export function parseResearch(raw: string): ResearchDataset {
  if (raw.length > 5e6) fail("import", "maximum file size 5 MB");
  const d = obj(JSON.parse(raw), "research");
  if (d.schemaVersion !== 1)
    fail(
      "schemaVersion",
      "unsupported version; preserve this file for migration",
    );
  str(d.protocolVersion, "protocolVersion");
  windowCheck(d.searchWindow, "searchWindow");
  const ids = new Set<string>();
  const refs = (a: unknown, p: string) => strings(a, p);
  for (const collection of [
    "papers",
    "screening",
    "coding",
    "requirements",
    "searchRuns",
    "materialReferences",
  ]) {
    const local = new Set<string>();
    arr(d[collection], collection).forEach((x, i) => {
      const o = obj(x, collection + i);
      str(o.id, collection + ".id");
      if (!o.id.trim() || local.has(o.id))
        fail(collection, "IDs must be unique and nonempty");
      local.add(o.id);
    });
  }
  d.papers.forEach((p: unknown, i: number) => {
    ids.add(validatePaper(p, `papers[${i}]`).id);
  });
  const paperRef = (v: any, p: string) => {
    str(v, p);
    if (!ids.has(v)) fail(p, "unknown paper ID");
  };
  const paperRefs = (v: any, p: string) => {
    refs(v, p);
    v.forEach((id: string) => paperRef(id, p));
  };
  d.screening.forEach((x: any, i: number) => {
    const p = `screening[${i}]`;
    paperRef(x.paperId, p);
    en(x.reviewStage, choices.reviewStage, p);
    en(x.decision, choices.decision, p);
    textFields(x, ["reviewerId", "comment"], p);
    if (!x.reviewerId.trim()) fail(p, "reviewer required");
    date(x.decisionDate, p);
    if (x.reasonCode !== undefined) str(x.reasonCode, p);
    if (x.decision === "exclude" && !x.reasonCode?.trim())
      fail(p, "exclusion reason required");
  });
  d.coding.forEach((x: any, i: number) => {
    const p = `coding[${i}]`;
    paperRef(x.paperId, p);
    textFields(x, ["reviewerId", "codebookVersion", "relevanceToStudio"], p);
    if (!x.reviewerId.trim()) fail(p, "reviewer required");
    en(x.status, choices.status, p);
    en(x.fabricationMaturity, choices.fabricationMaturity, p);
    date(x.updatedAt, p);
    for (const k of Object.keys(codebook) as (keyof typeof codebook)[])
      strings(x[k], p + "." + k, codebook[k]);
    strings(x.limitations, p);
    strings(x.proposedFeatureIds, p);
    arr(x.claims, p).forEach((c) => {
      obj(c, p);
      textFields(c, ["text", "locator"], p);
      url(c.sourceUrl, p);
      en(
        c.evidenceLevel,
        ["directly_reported", "interpretation", "hypothesis"],
        p,
      );
      if (!c.locator.trim() || !c.text.trim())
        fail(p, "claim and source locator required");
      if (c.capability !== undefined)
        en(c.capability, codebook.authoringCapabilities, p);
    });
    arr(x.designRights, p).forEach((r) => {
      obj(r, p);
      textFields(r, ["decisionType", "evidenceNote", "locator"], p);
      en(r.role, codebook.targetRoles, p);
      en(
        r.permission,
        ["propose", "edit", "approve", "validate", "not_reported"],
        p,
      );
      url(r.sourceUrl, p);
      if (!r.locator.trim() || !r.evidenceNote.trim())
        fail(p, "design right requires evidence note and locator");
    });
  });
  d.requirements.forEach((x: any) => {
    textFields(
      x,
      ["name", "description", "targetRole", "cadModule", "evidenceSummary"],
      "requirements",
    );
    en(
      x.status,
      ["proposed", "planned", "implemented", "tested", "deferred"],
      "requirements",
    );
    paperRefs(x.supportingPaperIds, "supportingPaperIds");
    paperRefs(x.counterexamplePaperIds, "counterexamplePaperIds");
    for (const k of ["assumptions", "verificationNeeded", "acceptanceCriteria"])
      strings(x[k], k);
  });
  const featureIds = new Set(d.requirements.map((x: any) => x.id));
  d.coding.forEach((x: any) =>
    x.proposedFeatureIds.forEach((id: string) => {
      if (!featureIds.has(id))
        fail("proposedFeatureIds", "unknown requirement");
    }),
  );
  d.searchRuns.forEach((x: any) => {
    textFields(x, ["sourceDatabase", "exactQuery", "notes"], "searchRuns");
    date(x.queryDate, "queryDate");
    windowCheck(x.searchWindow, "searchWindow");
    for (const k of ["resultCount", "importedCount"])
      if (x[k] !== undefined && (!Number.isSafeInteger(x[k]) || x[k] < 0))
        fail(k, "expected nonnegative count");
  });
  d.materialReferences.forEach((x: any) => {
    textFields(
      x,
      ["name", "type", "attribution", "reuseNotes", "verificationStatus"],
      "materialReferences",
    );
    url(x.sourceUrl, "sourceUrl");
    paperRefs(x.associatedPaperIds, "associatedPaperIds");
  });
  return d as ResearchDataset;
}
export function latestCoding(
  d: ResearchDataset,
  paperId: string,
): CodingRecord[] {
  const m = new Map<string, CodingRecord>();
  d.coding
    .filter((c) => c.paperId === paperId)
    .forEach((c) => m.set(c.reviewerId, c));
  return [...m.values()];
}
export function screeningState(d: ResearchDataset, id: string) {
  const records = d.screening.filter((s) => s.paperId === id);
  const latest = new Map<string, (typeof records)[number]>();
  records.forEach((s) => latest.set(s.reviewerId + ":" + s.reviewStage, s));
  const reviewers = new Set(records.map((s) => s.reviewerId));
  const effective = [...reviewers]
    .map((reviewer) => {
      const full = latest.get(reviewer + ":full_text");
      const title = latest.get(reviewer + ":title_abstract");
      const dedup = latest.get(reviewer + ":dedup");
      return full && full.decision !== "pending"
        ? full
        : (title ?? (dedup?.decision === "exclude" ? dedup : undefined));
    })
    .filter((s): s is NonNullable<typeof s> => !!s && s.decision !== "pending");
  if (!effective.length) return "Candidate";
  if (new Set(effective.map((s) => s.decision)).size > 1) return "Disagreement";
  if (effective[0].decision === "exclude") return "Excluded";
  if (effective[0].decision === "include")
    return effective.every((s) => s.reviewStage === "full_text")
      ? "Included"
      : "Awaiting full text";
  return "Maybe";
}
export type Filters = {
  query: string;
  yearFrom: string;
  yearTo: string;
  publicationType: string;
  verificationStatus: string;
  decision: string;
  topic: string;
  targetRoles: string;
  fabricationMethods: string;
  representations: string;
  sensorModalities: string;
  fabricationMaturity: string;
};
export const emptyFilters: Filters = {
  query: "",
  yearFrom: "",
  yearTo: "",
  publicationType: "",
  verificationStatus: "",
  decision: "",
  topic: "",
  targetRoles: "",
  fabricationMethods: "",
  representations: "",
  sensorModalities: "",
  fabricationMaturity: "",
};
export function filterPapers(d: ResearchDataset, f: Filters, sort = "title") {
  return d.papers
    .filter((p) => {
      const codes = latestCoding(d, p.id);
      return (
        (!f.query ||
          [
            p.title,
            ...p.authors,
            p.abstract ?? "",
            p.notes,
            ...p.keywords,
            ...p.topics,
          ]
            .join(" ")
            .toLowerCase()
            .includes(f.query.toLowerCase())) &&
        (!f.yearFrom || (p.year !== null && p.year >= +f.yearFrom)) &&
        (!f.yearTo || (p.year !== null && p.year <= +f.yearTo)) &&
        (!f.publicationType || p.publicationType === f.publicationType) &&
        (!f.verificationStatus ||
          p.verificationStatus === f.verificationStatus) &&
        (!f.decision || screeningState(d, p.id) === f.decision) &&
        (!f.topic || p.topics.includes(f.topic)) &&
        (
          [
            "targetRoles",
            "fabricationMethods",
            "representations",
            "sensorModalities",
          ] as const
        ).every((k) => !f[k] || codes.some((c) => c[k].includes(f[k]))) &&
        (!f.fabricationMaturity ||
          codes.some((c) => c.fabricationMaturity === f.fabricationMaturity))
      );
    })
    .sort((a, b) =>
      sort === "year"
        ? (b.year ?? -1) - (a.year ?? -1) || a.title.localeCompare(b.title)
        : a.title.localeCompare(b.title),
    );
}
export function capabilityEvidence(
  d: ResearchDataset,
  paperId: string,
  capability: string,
) {
  return latestCoding(d, paperId).flatMap((c) =>
    c.claims
      .filter((x) => x.capability === capability)
      .map((claim) => ({ claim, reviewer: c.reviewerId, status: c.status })),
  );
}
export function evidenceCounts(
  evidence: ReturnType<typeof capabilityEvidence>,
) {
  return {
    reported: evidence.filter(
      (e) => e.claim.evidenceLevel === "directly_reported",
    ).length,
    interpretation: evidence.filter(
      (e) => e.claim.evidenceLevel === "interpretation",
    ).length,
    hypothesis: evidence.filter((e) => e.claim.evidenceLevel === "hypothesis")
      .length,
  };
}
export function duplicates(papers: Paper[]) {
  const hits: { a: string; b: string; reason: string }[] = [];
  const title = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  for (let i = 0; i < papers.length; i++)
    for (let j = i + 1; j < papers.length; j++) {
      const a = papers[i],
        b = papers[j];
      if (a.doi && b.doi && normalizeDOI(a.doi) === normalizeDOI(b.doi))
        hits.push({ a: a.id, b: b.id, reason: "Matching normalized DOI" });
      else if (
        title(a.title) === title(b.title) &&
        (a.year === b.year || a.year === null || b.year === null)
      )
        hits.push({
          a: a.id,
          b: b.id,
          reason: "Matching title; review year/version",
        });
    }
  return hits;
}
export function csv(papers: Paper[]) {
  const cell = (v: unknown) => {
    let s = Array.isArray(v) ? v.join("; ") : v === null ? "" : String(v ?? "");
    if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const keys = [
    "id",
    "title",
    "authors",
    "year",
    "venue",
    "publicationType",
    "doi",
    "canonicalUrl",
    "verificationStatus",
    "notes",
  ] as const;
  return [
    keys.map(cell).join(","),
    ...papers.map((p) => keys.map((k) => cell(p[k])).join(",")),
  ].join("\r\n");
}
export function subset(d: ResearchDataset, papers: Paper[]): ResearchDataset {
  const ids = new Set(papers.map((p) => p.id));
  const requirements = d.requirements.map((r) => ({
    ...r,
    supportingPaperIds: r.supportingPaperIds.filter((id) => ids.has(id)),
    counterexamplePaperIds: r.counterexamplePaperIds.filter((id) =>
      ids.has(id),
    ),
  }));
  return {
    ...d,
    papers,
    screening: d.screening.filter((r) => ids.has(r.paperId)),
    coding: d.coding.filter((r) => ids.has(r.paperId)),
    requirements,
    materialReferences: d.materialReferences.map((r) => ({
      ...r,
      associatedPaperIds: r.associatedPaperIds.filter((id) => ids.has(id)),
    })),
  };
}
export function download(
  name: string,
  value: string,
  type = "application/json",
) {
  const u = URL.createObjectURL(new Blob([value], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
// RFC 4180-style quoted CSV parser. Candidate metadata stays unverified on CSV import.
export function importCSV(raw: string): { papers: Paper[]; errors: string[] } {
  const rows: string[][] = [];
  let row: string[] = [],
    v = "",
    quoted = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"') {
      if (quoted && raw[i + 1] === '"') {
        v += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\n")) {
      row.push(v.replace(/\r$/, ""));
      v = "";
      if (c === "\n") {
        rows.push(row);
        row = [];
      }
    } else v += c;
  }
  if (quoted) throw Error("CSV has an unclosed quoted field");
  if (v || row.length) {
    row.push(v.replace(/\r$/, ""));
    rows.push(row);
  }
  const headers = rows.shift()?.map((s) => s.trim()) ?? [];
  if (!headers.includes("title")) throw Error("CSV requires a title column");
  const errors: string[] = [],
    papers: Paper[] = [];
  rows
    .filter((r) => r.some(Boolean))
    .forEach((r, i) => {
      try {
        const fields = Object.fromEntries(
          headers.map((h, j) => [h, r[j] ?? ""]),
        );
        const date = new Date().toISOString().slice(0, 10);
        const p: Paper = {
          id: crypto.randomUUID(),
          title: fields.title,
          authors: fields.authors
            ? fields.authors.split(";").map((s) => s.trim())
            : [],
          year: fields.year ? Number(fields.year) : null,
          venue: fields.venue || null,
          publicationType: (fields.publicationType ||
            "other") as Paper["publicationType"],
          keywords: [],
          topics: [],
          verificationStatus: "needs_verification",
          verifiedAgainst: [],
          provenance: "manual_import",
          dateAdded: date,
          updatedAt: date,
          notes:
            fields.notes ||
            "Imported candidate; bibliography has not been checked.",
          ...(fields.doi ? { doi: normalizeDOI(fields.doi) } : {}),
          ...(fields.canonicalUrl ? { canonicalUrl: fields.canonicalUrl } : {}),
        };
        papers.push(validatePaper(p, `row ${i + 2}`));
      } catch (e) {
        errors.push((e as Error).message);
      }
    });
  return { papers, errors };
}
