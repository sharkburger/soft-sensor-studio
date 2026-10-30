import { useEffect, useRef, useState, type FormEvent } from "react";
import seed from "./seed.json";
import {
  codebook,
  emptyCoding,
  label,
  today,
  type CodingField,
  type CodingRecord,
  type Paper,
  type ResearchDataset,
  type ScreeningRecord,
} from "./model";
import {
  capabilityEvidence,
  evidenceCounts,
  csv,
  download,
  duplicates,
  emptyFilters,
  filterPapers,
  importCSV,
  latestCoding,
  parseResearch,
  screeningState,
  subset,
  type Filters,
} from "./service";
import "./research.css";
const storageKey = "soft-sensor-research-v1";
const initialSeed = () => parseResearch(JSON.stringify(seed));
function load() {
  try {
    const s = localStorage.getItem(storageKey);
    if (s) {
      const saved = parseResearch(s);
      const seedData = initialSeed();
      const knownPaperIds = new Set(saved.papers.map((paper) => paper.id));
      const additions = seedData.papers.filter(
        (paper) => !knownPaperIds.has(paper.id),
      );
      const seedPaperById = new Map(
        seedData.papers.map((paper) => [paper.id, paper]),
      );
      const refreshedNotes = saved.papers.filter((paper) => {
        const seeded = seedPaperById.get(paper.id);
        return !!seeded && seeded.notes.startsWith(paper.notes) && seeded.notes !== paper.notes;
      }).length;
      if (additions.length || refreshedNotes) {
        const addedIds = new Set(additions.map((paper) => paper.id));
        const merged = parseResearch(
          JSON.stringify({
            ...saved,
            papers: [
              ...saved.papers.map((paper) => {
                const seeded = seedPaperById.get(paper.id);
                return seeded && seeded.notes.startsWith(paper.notes)
                  ? { ...paper, notes: seeded.notes }
                  : paper;
              }),
              ...additions,
            ],
            screening: [
              ...saved.screening,
              ...seedData.screening.filter((record) =>
                addedIds.has(record.paperId),
              ),
            ],
            coding: [
              ...saved.coding,
              ...seedData.coding.filter((record) =>
                addedIds.has(record.paperId),
              ),
            ],
          }),
        );
        try {
          localStorage.setItem(storageKey, JSON.stringify(merged));
        } catch {
          // Keep the merged seed available in memory when browser storage is full.
        }
        return {
          data: merged,
          message: `Restored local Research workspace, added ${additions.length} new seed candidate${additions.length === 1 ? "" : "s"}, and refreshed ${refreshedNotes} source note${refreshedNotes === 1 ? "" : "s"}.`,
        };
      }
      return {
        data: saved,
        message: "Restored local Research workspace.",
      };
    }
    return {
      data: initialSeed(),
      message: "Seed corpus loaded. Changes are local to this browser.",
    };
  } catch (e) {
    return {
      data: initialSeed(),
      message:
        "Saved Research data could not be restored. It has not been overwritten. Export your browser data before saving new changes. " +
        (e as Error).message,
    };
  }
}
const sections = [
  "analysis",
  "database",
] as const;
const titles = [
  "Analysis",
  "Paper Database",
];
const link = (paper?: string, section = "database") =>
  `?section=${section}${paper ? "&paper=" + encodeURIComponent(paper) : ""}`;
function shortName(p: Paper) {
  return p.id === "pneuact"
    ? "PneuAct"
    : p.id === "upper-limb-biofeedback"
      ? "Upper-limb biofeedback"
      : p.title.split(":")[0];
}
function Source({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <a href={url} target="_blank" rel="noreferrer">
      {children} ↗
    </a>
  );
}
export default function Research() {
  const [initial] = useState(load);
  const [data, setData] = useState(initial.data);
  const [notice, setNotice] = useState(initial.message);
  const [route, setRoute] = useState(
    () => new URLSearchParams(location.search),
  );
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [sort, setSort] = useState("title");
  const [staged, setStaged] = useState<{
    data: ResearchDataset;
    mode: "replace" | "append";
    errors: string[];
  } | null>(null);
  const section = sections.includes(
    route.get("section") as (typeof sections)[number],
  )
    ? route.get("section")!
    : route.has("paper")
      ? "database"
      : "analysis";
  const selected = data.papers.find((p) => p.id === route.get("paper"));
  const shown = filterPapers(data, filters, sort);
  const detailRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selected && section === "database") {
      detailRef.current?.focus({ preventScroll: true });
      detailRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [selected?.id, section]);
  const navigate = (id?: string, s = section) => {
    history.pushState(null, "", link(id, s));
    setRoute(new URLSearchParams(location.search));
  };
  useEffect(() => {
    const f = () => setRoute(new URLSearchParams(location.search));
    window.addEventListener("popstate", f);
    return () => window.removeEventListener("popstate", f);
  }, []);
  function save(next: ResearchDataset) {
    try {
      const valid = parseResearch(JSON.stringify(next));
      setData(valid);
      try {
        localStorage.setItem(storageKey, JSON.stringify(valid));
        setNotice(
          "Saved locally in this browser. Download a JSON backup to share or preserve your work.",
        );
      } catch {
        setNotice(
          "Browser storage unavailable. Changes are in memory; download a JSON backup now.",
        );
      }
    } catch (e) {
      setNotice("Not saved: " + (e as Error).message);
    }
  }
  async function importFile(f: File) {
    try {
      if (f.size > 5e6) throw Error("Maximum file size is 5 MB");
      const raw = await f.text();
      if (f.name.toLowerCase().endsWith(".csv")) {
        const r = importCSV(raw);
        if (data.papers.length + r.papers.length > 1000)
          throw Error("Workspace limit: 1,000 papers");
        setStaged({
          data: { ...data, papers: [...data.papers, ...r.papers] },
          mode: "append",
          errors: r.errors,
        });
      } else {
        const d = parseResearch(raw);
        if (d.papers.length > 1000)
          throw Error("Workspace limit: 1,000 papers");
        setStaged({ data: d, mode: "replace", errors: [] });
      }
      setNotice("Import preview ready. Nothing has been changed yet.");
    } catch (e) {
      setNotice("Import rejected: " + (e as Error).message);
    }
  }
  const stats = [
    ["Records", data.papers.length],
    [
      "Verified bibliography",
      data.papers.filter((p) => p.verificationStatus === "verified").length,
    ],
    [
      "Included",
      data.papers.filter((p) => screeningState(data, p.id) === "Included")
        .length,
    ],
    [
      "With source notes",
      data.papers.filter((p) =>
        latestCoding(data, p.id).some((c) => c.claims.length),
      ).length,
    ],
  ];
  return (
    <div className="research-app">
      <div className="r-header">
        <a className="r-brand" href="./">
          <span className="soft-cad-logo-crop"><img src="./soft-sensor-cad-logo.png" alt="" /></span>
          soft sensor <span>STUDIO</span>
        </a>
        <span>RESEARCH / SEED CORPUS</span>
        <a href="./studio.html">Open CAD ↗</a>
        <a href="./showcase.html">Pattern Playground ↗</a>
      </div>
      <div className="r-hero">
        <div>
          <p className="r-eyebrow">CLINICAL-TO-TEXTILE TRANSLATION</p>
          <h1>
            Research Database<span>.</span>
          </h1>
          <p>
            A source-linked workspace for mapping how textile tools turn
            situated needs into editable designs.
          </p>
        </div>
        <div className="r-stats">
          {stats.map(([name, n]) => (
            <div key={name}>
              <strong>{n}</strong>
              <span>{name}</span>
            </div>
          ))}
        </div>
      </div>
      <nav className="r-nav" aria-label="Research views">
        {sections.map((s, i) => (
          <a
            key={s}
            href={link(undefined, s)}
            aria-current={section === s ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              navigate(undefined, s);
            }}
          >
            {String(i + 1).padStart(2, "0")} {titles[i]}
          </a>
        ))}
      </nav>
      <p className="r-disclaimer">
        Research prototype; literature mapping is ongoing; not a clinical
        decision-support or verified fabrication system.
      </p>
      <div className="r-status" role="status">
        {notice}
      </div>
      <div className="r-content">
        {route.has("paper") && !selected && (
          <p role="alert">
            The requested paper ID is not in this Research workspace. Choose a
            record from the database.
          </p>
        )}
        {(section === "database" || section === "atlas") && (
          <>
            <div className="r-toolbar">
              <label className="r-search">
                Search corpus
                <input
                  value={filters.query}
                  onChange={(e) =>
                    setFilters({ ...filters, query: e.target.value })
                  }
                  placeholder="Title, author, notes, keyword…"
                />
              </label>
              <label>
                Sort
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="title">Title A–Z</option>
                  <option value="year">Year, newest first</option>
                </select>
              </label>
              <button
                onClick={() =>
                  download("research-filtered.csv", csv(shown), "text/csv")
                }
              >
                Export CSV
              </button>
              <button
                onClick={() =>
                  download(
                    "research-filtered.json",
                    JSON.stringify(subset(data, shown), null, 2),
                  )
                }
              >
                Export JSON
              </button>
            </div>
            <details className="r-filters">
              <summary>
                Filters · {Object.values(filters).filter(Boolean).length} active
                · {shown.length} of {data.papers.length} records
              </summary>
              <div className="r-filter-grid">
                <label>
                  Year from
                  <input
                    type="number"
                    min="1800"
                    max="2200"
                    value={filters.yearFrom}
                    onChange={(e) =>
                      setFilters({ ...filters, yearFrom: e.target.value })
                    }
                  />
                </label>
                <label>
                  Year to
                  <input
                    type="number"
                    min="1800"
                    max="2200"
                    value={filters.yearTo}
                    onChange={(e) =>
                      setFilters({ ...filters, yearTo: e.target.value })
                    }
                  />
                </label>
                {[
                  [
                    "publicationType",
                    [
                      "conference",
                      "journal",
                      "preprint",
                      "project_page",
                      "other",
                    ],
                  ],
                  [
                    "verificationStatus",
                    [
                      "verified",
                      "partially_verified",
                      "needs_verification",
                      "unresolved",
                    ],
                  ],
                  [
                    "decision",
                    [
                      "Candidate",
                      "Included",
                      "Excluded",
                      "Awaiting full text",
                      "Disagreement",
                      "Maybe",
                    ],
                  ],
                  ["topic", [...new Set(data.papers.flatMap((p) => p.topics))]],
                  ...(
                    [
                      "targetRoles",
                      "fabricationMethods",
                      "representations",
                      "sensorModalities",
                    ] as const
                  ).map((k) => [k, codebook[k]]),
                  [
                    "fabricationMaturity",
                    [
                      "concept",
                      "visual_preview",
                      "fabrication_export",
                      "fabricated",
                      "bench_validated",
                      "clinical_evaluated",
                      "unknown",
                    ],
                  ],
                ].map(([key, options]) => (
                  <label key={key as string}>
                    {label(key as string)}
                    <select
                      value={filters[key as keyof Filters]}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          [key as string]: e.target.value,
                        })
                      }
                    >
                      <option value="">All</option>
                      {(options as readonly string[]).map((o) => (
                        <option key={o} value={o}>
                          {label(o)}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <button onClick={() => setFilters(emptyFilters)}>
                Reset filters
              </button>
              <p>
                Active:{" "}
                {Object.entries(filters)
                  .filter(([, v]) => v)
                  .map(([k, v]) => `${label(k)}: ${v}`)
                  .join(" · ") || "None"}
                . Year filters omit records with unknown years.
              </p>
            </details>
          </>
        )}
        {section === "database" && (
          <div className="r-database">
            <div>
              <div className="r-section-head">
                <h2>Candidate corpus</h2>
                <span>
                  {shown.length} records · screening pending unless recorded
                </span>
              </div>
              {shown.length === 0 ? (
                <p className="r-empty">
                  No matching records. Adjust or reset your filters.
                </p>
              ) : (
                shown.map((p) => (
                  <button
                    key={p.id}
                    className={
                      "r-paper " + (selected?.id === p.id ? "r-selected" : "")
                    }
                    onClick={() => navigate(p.id)}
                  >
                    <div>
                      <span className={"r-badge " + p.verificationStatus}>
                        {label(p.verificationStatus)}
                      </span>
                      <span className="r-state">
                        {screeningState(data, p.id)}
                      </span>
                    </div>
                    <h3>{p.title}</h3>
                    <p>
                      {p.authors.length
                        ? p.authors.join(", ")
                        : "Authors not yet verified"}
                    </p>
                    <small>
                      {p.year ?? "Year unknown"} · {p.venue ?? "Venue unknown"}{" "}
                      · {label(p.publicationType)}
                    </small>
                    <div className="r-tags">
                      {p.topics.map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                    </div>
                  </button>
                ))
              )}
            </div>
            <aside
              className="r-detail"
              ref={detailRef}
              tabIndex={-1}
              aria-label="Paper details"
            >
              {selected ? (
                <PaperDetail data={data} paper={selected} onSelect={navigate} />
              ) : (
                <>
                  <p className="r-eyebrow">PAPER RECORD</p>
                  <h2>Follow the evidence.</h2>
                  <p>
                    Select a candidate to inspect its bibliography, source
                    checks, reviewer decisions and coded observations.
                  </p>
                  <p>
                    Bibliographic verification does not imply inclusion or
                    validated clinical guidance.
                  </p>
                </>
              )}
            </aside>
          </div>
        )}
        {section === "analysis" && <ReviewAnalysis data={data} />}
        {section === "atlas" && (
          <>
            <h2>Paper × authoring capability</h2>
            <p>
              Uses the filtered corpus and latest revision per reviewer. R =
              directly reported; I = reviewer interpretation; H = hypothesis.
              Counts are source-linked notes, not scores or consensus. “?” means
              unknown / not coded; it never means absent.
            </p>
            <div className="r-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Paper</th>
                    {codebook.authoringCapabilities
                      .filter((c) => c !== "other")
                      .map((c) => (
                        <th key={c}>{label(c)}</th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.id}>
                      <th>
                        <button onClick={() => navigate(p.id, "database")}>
                          {shortName(p)}
                        </button>
                      </th>
                      {codebook.authoringCapabilities
                        .filter((c) => c !== "other")
                        .map((c) => {
                          const ev = capabilityEvidence(data, p.id, c);
                          const counts = evidenceCounts(ev);
                          const text = ev.length
                            ? [
                                counts.reported ? `R ${counts.reported}` : "",
                                counts.interpretation
                                  ? `I ${counts.interpretation}`
                                  : "",
                                counts.hypothesis
                                  ? `H ${counts.hypothesis}`
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" / ")
                            : "?";
                          return (
                            <td key={c}>
                              <button
                                className={
                                  ev.length
                                    ? "r-cell-evidence"
                                    : "r-cell-unknown"
                                }
                                aria-label={`${p.title}: ${label(c)}; ${ev.length ? counts.reported + " reported, " + counts.interpretation + " interpretations, " + counts.hypothesis + " hypotheses" : "unknown"}`}
                                onClick={() => navigate(p.id, "database")}
                              >
                                {text}
                              </button>
                            </td>
                          );
                        })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h2>Role × authoring rights</h2>
            <p>
              Only explicit rights records appear here. Target roles do not
              establish permissions. Each entry opens its paper, evidence note,
              reviewer and locator.
            </p>
            <div className="r-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Role</th>
                    {[
                      "propose",
                      "edit",
                      "approve",
                      "validate",
                      "not_reported",
                    ].map((s) => (
                      <th key={s}>{label(s)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    "clinician",
                    "designer",
                    "textile_engineer",
                    "electronics_engineer",
                    "patient",
                  ].map((role) => (
                    <tr key={role}>
                      <th>{label(role)}</th>
                      {[
                        "propose",
                        "edit",
                        "approve",
                        "validate",
                        "not_reported",
                      ].map((permission) => (
                        <td key={permission}>
                          <RightsCell
                            data={data}
                            papers={shown}
                            role={role}
                            permission={permission}
                            onSelect={(id) => navigate(id, "database")}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selected && (
              <div className="r-card">
                <PaperDetail data={data} paper={selected} onSelect={navigate} />
              </div>
            )}
          </>
        )}
        {section === "screening" && (
          <>
            <div className="r-section-head">
              <div>
                <h2>Screen, code, preserve decisions</h2>
                <p>
                  Append-only reviewer history. Changes and imports stay local;
                  no CAD project data is modified.
                </p>
              </div>
              <button
                onClick={() =>
                  download(
                    "research-backup.json",
                    JSON.stringify(data, null, 2),
                  )
                }
              >
                Download full backup
              </button>
            </div>
            <div className="r-card">
              <h3>Import and deduplicate</h3>
              <label>
                Import Research JSON or candidate CSV
                <input
                  type="file"
                  accept=".json,.csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void importFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <p>
                JSON restores a versioned workspace after validation and
                preview. CSV appends candidates; columns: title (required),
                authors (semicolon separated), year, venue, publicationType,
                doi, canonicalUrl, notes. CSV records remain unverified. BibTeX
                import is not supported.
              </p>
              {staged && (
                <div className="r-import">
                  <h4>
                    {staged.mode === "replace"
                      ? "Replace Research workspace"
                      : "Append CSV candidates"}
                    : {staged.data.papers.length} resulting records
                  </h4>
                  {staged.errors.map((e, i) => (
                    <p key={i} role="alert">
                      {e}
                    </p>
                  ))}
                  <DuplicateList data={staged.data} />
                  <p>
                    Duplicate suggestions require human review. Records are
                    retained separately; no automatic merges.
                  </p>
                  <button
                    onClick={() => {
                      save(staged.data);
                      setStaged(null);
                    }}
                  >
                    Confirm import {staged.errors.length ? "of valid rows" : ""}
                  </button>
                  <button onClick={() => setStaged(null)}>Cancel import</button>
                </div>
              )}
              <DuplicateList data={data} />
            </div>
            <label>
              Choose a paper
              <select
                value={selected?.id ?? ""}
                onChange={(e) => navigate(e.target.value)}
              >
                <option value="">Select candidate…</option>
                {data.papers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            {selected ? (
              <>
                <div className="r-card">
                  <h2>{selected.title}</h2>
                  <ScreeningForm
                    key={selected.id}
                    paper={selected}
                    data={data}
                    save={save}
                  />
                </div>
                <CodingForm
                  key={"coding-" + selected.id}
                  data={data}
                  paper={selected}
                  save={save}
                />
                <div className="r-card">
                  <PaperDetail
                    data={data}
                    paper={selected}
                    onSelect={navigate}
                  />
                </div>
              </>
            ) : (
              <p className="r-empty">
                Choose a candidate to record a screening decision or a
                source-linked coding revision.
              </p>
            )}
            <button
              onClick={() =>
                download(
                  "research-coding.json",
                  JSON.stringify(
                    { schemaVersion: 1, coding: data.coding },
                    null,
                    2,
                  ),
                )
              }
            >
              Export coding table (JSON)
            </button>
          </>
        )}
        {section === "requirements" && (
          <>
            <h2>Knowledge → CAD requirements</h2>
            <p>
              Source-linked research hypotheses. Existing implementation status
              is independent of evidential support. These proposals do not alter
              CAD settings or recommend clinically validated designs.
            </p>
            {data.requirements.map((r) => (
              <article className="r-card" key={r.id}>
                <span className="r-badge">{r.status} · hypothesis</span>
                <h3>{r.name}</h3>
                <p>{r.description}</p>
                <p>
                  {r.targetRole} · {r.cadModule}
                </p>
                <p>{r.evidenceSummary}</p>
                <h4>Context / supporting candidates</h4>
                {r.supportingPaperIds.map((id) => (
                  <a
                    className="r-source-chip"
                    key={id}
                    href={link(id)}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(id, "database");
                    }}
                  >
                    {data.papers.find((p) => p.id === id)?.title}
                  </a>
                ))}
                <h4>Counterexamples</h4>
                {r.counterexamplePaperIds.length ? (
                  r.counterexamplePaperIds.map((id) => (
                    <a key={id} href={link(id)}>
                      {data.papers.find((p) => p.id === id)?.title}
                    </a>
                  ))
                ) : (
                  <p>
                    None recorded; counterexample search has not been completed.
                  </p>
                )}
                {[
                  ["Assumptions", r.assumptions],
                  ["Verification needed", r.verificationNeeded],
                  ["Acceptance criteria", r.acceptanceCriteria],
                ].map(([t, items]) => (
                  <div key={t as string}>
                    <h4>{t}</h4>
                    <ul>
                      {(items as string[]).map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </article>
            ))}
          </>
        )}
        {section === "methods" && <Methods data={data} save={save} />}
      </div>
      <footer className="r-footer">
        Local-first literature workspace · Protocol {data.protocolVersion} ·
        Codebook 1.0 · No full-text review or exhaustive coverage claimed
      </footer>
    </div>
  );
}
const reviewAnalysis = {
  sensors: [
    ["Stretch / strain", 53, "46.5%"], ["Electrode", 27, "23.7%"],
    ["Pressure", 20, "17.5%"], ["Piezoresistive (general)", 14, "12.3%"],
    ["Capacitive", 11, "9.6%"], ["Force", 8, "7.0%"],
    ["Compression / deformation", 5, "4.4%"], ["Resistance", 3, "2.6%"],
    ["Tactile / touch (other)", 3, "2.6%"], ["Electrical impedance tomography", 1, "0.9%"], ["Distance", 1, "0.9%"],
  ] as const,
  applications: [
    ["Motion / activity", 38, "33.3%"], ["Sensor development (general)", 31, "27.2%"],
    ["Respiration", 20, "17.5%"], ["ECG", 15, "13.2%"], ["EMG", 9, "7.9%"],
    ["Soft robotics / actuation", 7, "6.1%"], ["Non-respiratory body expansion", 5, "4.4%"],
    ["Touch", 4, "3.5%"], ["Heart rate", 3, "2.6%"], ["Distance", 2, "1.8%"],
    ["Grip", 2, "1.8%"], ["Posture", 2, "1.8%"], ["Interface", 2, "1.8%"],
    ["Garment wear location", 1, "0.9%"], ["Proximity", 1, "0.9%"], ["Moisture", 1, "0.9%"],
  ] as const,
  machines: [["Brand and model", 62, "54.4%"], ["Type only", 21, "18.4%"], ["No machine information", 18, "15.8%"], ["Manufacturer, no model", 13, "11.4%"]] as const,
  materials: [["Silver", 54, "58.1%"], ["Stainless steel", 17, "18.3%"], ["Carbon", 15, "16.1%"], ["Copper", 6, "6.5%"], ["Other unique material", 8, "8.6%"]] as const,
  integration: [["Knit into full garment", 32, "28.1%"], ["Attached, not directly knit", 14, "12.3%"], ["Knit-in conductive interface traces", 1, "0.9%"], ["No garment integration", 67, "58.8%"]] as const,
  human: [["Yes", 73, "64.0%"], ["No", 35, "30.7%"], ["Unclear", 6, "5.6%"]] as const,
};
function ReviewBars({ title, rows, denominator = 114, note }: {
  title: string;
  rows: readonly (readonly [string, number, string])[];
  denominator?: number;
  note?: string;
}) {
  const max = Math.max(...rows.map((row) => row[1]));
  return <article className="r-card r-analysis-card">
    <h2>{title}</h2>
    {note && <p className="r-analysis-note">{note}</p>}
    <div className="r-bars">
      {rows.map(([name, count, percent]) => <div className="r-bar-row" key={name}>
        <div className="r-bar-label"><span>{name}</span><strong>{count} <small>({percent})</small></strong></div>
        <div className="r-bar-track" aria-label={`${name}: ${count} of ${denominator}`}><span style={{ width: `${Math.max(2, (count / max) * 100)}%` }} /></div>
      </div>)}
    </div>
  </article>;
}
function ReviewAnalysis({ data }: { data: ResearchDataset }) {
  void data;
  return <section className="r-analysis">
    <div className="r-section-head"><div><p className="r-eyebrow">LITERATURE ANALYSIS · SEARCH THROUGH 2023-10-31</p><h2>Machine-knit sensor research: Results</h2></div></div>
    <p className="r-analysis-intro">Descriptive results across 114 analyzed manuscripts.</p>
    <div className="r-analysis-summary">
      <div><strong>114</strong><span>manuscripts analyzed</span></div>
      <div><strong>4</strong><span>literature databases searched</span></div>
      <div><strong>2023</strong><span>search completed October 31</span></div>
    </div>
    <p className="r-analysis-caveat"><b>Reading the results.</b> Categories can overlap, so percentages may add to more than 100%. Material percentages use the subset of 93 manuscripts with clear conductive-material reporting.</p>
    <div className="r-analysis-grid">
      <ReviewBars title="Sensor types" rows={reviewAnalysis.sensors} note="n = 114 · classifications may overlap" />
      <ReviewBars title="Applications" rows={reviewAnalysis.applications} note="n = 114 · classifications may overlap" />
      <ReviewBars title="Knitting machine reporting" rows={reviewAnalysis.machines} note="n = 114" />
      <ReviewBars title="Conductive materials" rows={reviewAnalysis.materials} denominator={93} note="Clear material reported for n = 93 · materials may co-occur" />
      <ReviewBars title="Garment integration" rows={reviewAnalysis.integration} note="n = 114" />
      <ReviewBars title="Human testing" rows={reviewAnalysis.human} note="n = 114 · percentages are rounded" />
    </div>
    <article className="r-card r-analysis-card">
      <h2>Key findings</h2>
      <div className="r-analysis-findings"><p><b>Validation</b><br />Accuracy validation and comparison with common wearable sensors remain limited. No randomized controlled trials were identified.</p><p><b>Reproducibility</b><br />Reporting of yarn composition, manufacturer, machine model and settings, gauge, and knitting instructions can be strengthened.</p><p><b>Cross-disciplinary research</b><br />The field can benefit from collaboration across textile engineering, HCI, fashion, and application domains.</p></div>
    </article>
  </section>;
}

function RightsCell({
  data,
  papers,
  role,
  permission,
  onSelect,
}: {
  data: ResearchDataset;
  papers: Paper[];
  role: string;
  permission: string;
  onSelect: (id: string) => void;
}) {
  const rights = papers.flatMap((p) =>
    latestCoding(data, p.id).flatMap((c) =>
      c.designRights
        .filter((r) => r.role === role && r.permission === permission)
        .map((right, i) => ({
          paper: p,
          reviewer: c.reviewerId,
          id: c.id + ":" + i,
          right,
        })),
    ),
  );
  return rights.length ? (
    <>
      {rights.map((x) => (
        <button key={x.id} onClick={() => onSelect(x.paper.id)}>
          {shortName(x.paper)} · {label(x.right.decisionType)} · {x.reviewer}
        </button>
      ))}
    </>
  ) : (
    <span className="r-muted">Unknown</span>
  );
}
function DuplicateList({ data }: { data: ResearchDataset }) {
  const found = duplicates(data.papers);
  return (
    <div>
      <h4>Duplicate suggestions · {found.length}</h4>
      {found.length ? (
        found.map((d, i) => (
          <p key={i}>
            {data.papers.find((p) => p.id === d.a)?.title} ↔{" "}
            {data.papers.find((p) => p.id === d.b)?.title} — {d.reason} ({d.a} /{" "}
            {d.b})
          </p>
        ))
      ) : (
        <p>
          No DOI or normalized title/year matches in this workspace. This does
          not rule out duplicates.
        </p>
      )}
    </div>
  );
}
function PaperDetail({
  data,
  paper: p,
  onSelect,
}: {
  data: ResearchDataset;
  paper: Paper;
  onSelect: (id: string, s?: string) => void;
}) {
  const codes = latestCoding(data, p.id);
  return (
    <>
      <p className="r-eyebrow">SOURCE RECORD / {p.id}</p>
      <h2>{p.title}</h2>
      <span className="r-badge">{label(p.verificationStatus)}</span>{" "}
      <span className="r-state">{screeningState(data, p.id)}</span>
      <p>
        {p.authors.join("; ") || "Authors: unknown"}. (
        {p.year ?? "Year unknown"}). <i>{p.venue ?? "Venue unknown"}</i>.{" "}
        {label(p.publicationType)}.
      </p>
      <p>
        {p.doi ? (
          <Source url={"https://doi.org/" + p.doi}>DOI: {p.doi}</Source>
        ) : (
          "DOI: not verified / unknown"
        )}
      </p>
      {p.canonicalUrl && (
        <p>
          <Source url={p.canonicalUrl}>Canonical / checked source</Source>
        </p>
      )}
      {p.openAccessUrl && (
        <p>
          <Source url={p.openAccessUrl}>Open access source</Source>
        </p>
      )}
      <p>{p.notes}</p>
      {p.abstract && <p>{p.abstract}</p>}
      <h3>Verification ledger</h3>
      {p.verifiedAgainst.length ? (
        p.verifiedAgainst.map((v, i) => (
          <p key={i}>
            <Source url={v.url}>Source {i + 1}</Source>
            <br />
            {v.checkDate} · Checked: {v.fields.join(", ")}
          </p>
        ))
      ) : (
        <p>
          No primary metadata check completed. This is an unresolved candidate
          label.
        </p>
      )}
      <p>
        Provenance: {label(p.provenance)} · Added {p.dateAdded} · Updated{" "}
        {p.updatedAt}
      </p>
      <h3>Screening history</h3>
      {data.screening.filter((s) => s.paperId === p.id).length ? (
        data.screening
          .filter((s) => s.paperId === p.id)
          .map((s) => (
            <p key={s.id}>
              {s.decisionDate} · {s.reviewerId} · {label(s.reviewStage)} ·{" "}
              <strong>{s.decision}</strong>{" "}
              {s.reasonCode && "— " + s.reasonCode}
              <br />
              {s.comment}
            </p>
          ))
      ) : (
        <p>No decisions recorded. Candidate status only.</p>
      )}
      <button onClick={() => onSelect(p.id, "screening")}>
        Screen or code this record
      </button>
      <h3>Evidence and coding</h3>
      {codes.length ? (
        codes.map((c) => (
          <div className="r-evidence" key={c.id}>
            <p>
              <strong>{c.reviewerId}</strong> · {label(c.status)} · Codebook{" "}
              {c.codebookVersion} · {c.updatedAt}
            </p>
            {(Object.keys(codebook) as CodingField[]).map((k) => (
              <p key={k}>
                {label(k)}:{" "}
                {c[k].map(label).join(", ") || "Unknown / not coded"}
              </p>
            ))}
            <p>Maturity: {label(c.fabricationMaturity)}</p>
            {c.claims.map((claim, i) => (
              <blockquote key={i}>
                <span className="r-badge">{label(claim.evidenceLevel)}</span>
                <p>{claim.text}</p>
                <Source url={claim.sourceUrl}>{claim.locator}</Source>
                {claim.capability && (
                  <p>Capability: {label(claim.capability)}</p>
                )}
              </blockquote>
            ))}
            {c.designRights.map((r, i) => (
              <p key={i}>
                <strong>
                  {label(r.role)} · {r.permission} · {label(r.decisionType)}
                </strong>
                <br />
                {r.evidenceNote}
                <br />
                <Source url={r.sourceUrl}>{r.locator}</Source>
              </p>
            ))}
            <p>Limitations: {c.limitations.join(" ") || "Not recorded"}</p>
            <p>{c.relevanceToStudio}</p>
          </div>
        ))
      ) : (
        <p>Uncoded. Capabilities, roles and maturity remain unknown.</p>
      )}
      <h3>Linked requirements</h3>
      {data.requirements
        .filter(
          (r) =>
            r.supportingPaperIds.includes(p.id) ||
            r.counterexamplePaperIds.includes(p.id),
        )
        .map((r) => (
          <p key={r.id}>
            <a href={link(undefined, "requirements")}>{r.name}</a> · hypothesis
          </p>
        ))}
    </>
  );
}
function ScreeningForm({
  data,
  paper,
  save,
}: {
  data: ResearchDataset;
  paper: Paper;
  save: (d: ResearchDataset) => void;
}) {
  const [error, setError] = useState("");
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const decision = f.get("decision") as ScreeningRecord["decision"];
    const reviewerId = String(f.get("reviewer")).trim(),
      reasonCode = String(f.get("reason")).trim();
    if (!reviewerId || (decision === "exclude" && !reasonCode)) {
      setError("Reviewer is required; exclusions also require a reason.");
      return;
    }
    save({
      ...data,
      screening: [
        ...data.screening,
        {
          id: crypto.randomUUID(),
          paperId: paper.id,
          reviewerId,
          reviewStage: f.get("stage") as ScreeningRecord["reviewStage"],
          decision,
          reasonCode,
          decisionDate: today(),
          comment: String(f.get("comment")),
        },
      ],
    });
    setError("Decision appended to history.");
  }
  return (
    <form onSubmit={submit} className="r-form">
      <h3>Append screening decision</h3>
      <label>
        Reviewer ID
        <input name="reviewer" required placeholder="e.g. reviewer-01" />
      </label>
      <label>
        Stage
        <select name="stage">
          <option value="title_abstract">Title / abstract</option>
          <option value="full_text">Full text</option>
          <option value="dedup">Deduplication</option>
        </select>
      </label>
      <label>
        Decision
        <select name="decision">
          {["pending", "include", "exclude", "maybe"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label>
        Reason code (required for exclusion)
        <input
          name="reason"
          placeholder="e.g. no_authoring_workflow"
          list="reasons"
        />
      </label>
      <datalist id="reasons">
        {[
          "out_of_scope",
          "no_authoring_workflow",
          "duplicate_version",
          "non_academic",
          "unrelated_wearable",
        ].map((r) => (
          <option key={r}>{r}</option>
        ))}
      </datalist>
      <label className="r-wide">
        Comment
        <textarea name="comment" />
      </label>
      <button>Append decision</button>
      <p role="status">{error}</p>
    </form>
  );
}
function CodingForm({
  data,
  paper,
  save,
}: {
  data: ResearchDataset;
  paper: Paper;
  save: (d: ResearchDataset) => void;
}) {
  const [draft, setDraft] = useState<CodingRecord>(() =>
    emptyCoding(paper.id, ""),
  );
  const [message, setMessage] = useState("");
  const [claim, setClaim] = useState({
    text: "",
    sourceUrl: paper.canonicalUrl ?? "",
    locator: "",
    evidenceLevel: "directly_reported" as
      "directly_reported" | "interpretation" | "hypothesis",
    capability: "placement" as (typeof codebook.authoringCapabilities)[number],
  });
  const [right, setRight] = useState({
    role: "clinician",
    decisionType: "geometry",
    permission: "edit" as
      "edit" | "propose" | "approve" | "validate" | "not_reported",
    evidenceNote: "",
    locator: "",
    sourceUrl: paper.canonicalUrl ?? "",
  });
  const patch = (p: Partial<CodingRecord>) => setDraft({ ...draft, ...p });
  return (
    <div className="r-card">
      <h3>Append coding revision</h3>
      <p>
        Each save adds a revision; history stays in the backup. Atlas uses the
        latest revision for each reviewer, without reconciling disagreements.
      </p>
      <div className="r-form">
        <label>
          Reviewer ID
          <input
            value={draft.reviewerId}
            onChange={(e) => patch({ reviewerId: e.target.value })}
          />
        </label>
        <label>
          Status
          <select
            value={draft.status}
            onChange={(e) =>
              patch({ status: e.target.value as CodingRecord["status"] })
            }
          >
            {["uncoded", "in_progress", "coded", "reconciled"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Load prior reviewer revision
          <select
            value=""
            onChange={(e) => {
              const c = data.coding.find((c) => c.id === e.target.value);
              if (c)
                setDraft({ ...structuredClone(c), id: crypto.randomUUID() });
            }}
          >
            <option value="">Choose revision…</option>
            {data.coding
              .filter((c) => c.paperId === paper.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.reviewerId} · {c.updatedAt} · {c.id}
                </option>
              ))}
          </select>
        </label>
        <label>
          Maturity
          <select
            value={draft.fabricationMaturity}
            onChange={(e) =>
              patch({
                fabricationMaturity: e.target
                  .value as CodingRecord["fabricationMaturity"],
              })
            }
          >
            {[
              "unknown",
              "concept",
              "visual_preview",
              "fabrication_export",
              "fabricated",
              "bench_validated",
              "clinical_evaluated",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      {(Object.keys(codebook) as CodingField[]).map((k) => (
        <fieldset key={k}>
          <legend>{label(k)} · empty means unknown</legend>
          <div className="r-checks">
            {codebook[k].map((value) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={draft[k].includes(value)}
                  onChange={(e) =>
                    patch({
                      [k]: e.target.checked
                        ? [...draft[k], value]
                        : draft[k].filter((v) => v !== value),
                    })
                  }
                />
                {label(value)}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <fieldset>
        <legend>Add source-linked claim</legend>
        <div className="r-form">
          <label>
            Finding
            <textarea
              value={claim.text}
              onChange={(e) => setClaim({ ...claim, text: e.target.value })}
            />
          </label>
          <label>
            Evidence level
            <select
              value={claim.evidenceLevel}
              onChange={(e) =>
                setClaim({
                  ...claim,
                  evidenceLevel: e.target.value as typeof claim.evidenceLevel,
                })
              }
            >
              {["directly_reported", "interpretation", "hypothesis"].map(
                (s) => (
                  <option key={s}>{s}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Source URL
            <input
              type="url"
              value={claim.sourceUrl}
              onChange={(e) =>
                setClaim({ ...claim, sourceUrl: e.target.value })
              }
            />
          </label>
          <label>
            Page / section locator
            <input
              value={claim.locator}
              onChange={(e) => setClaim({ ...claim, locator: e.target.value })}
            />
          </label>
          <label>
            Atlas capability
            <select
              value={claim.capability}
              onChange={(e) =>
                setClaim({
                  ...claim,
                  capability: e.target.value as typeof claim.capability,
                })
              }
            >
              {codebook.authoringCapabilities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              if (
                !claim.text.trim() ||
                !claim.locator.trim() ||
                !/^https?:\/\//.test(claim.sourceUrl)
              ) {
                setMessage("Claim requires text, source URL and locator.");
                return;
              }
              patch({ claims: [...draft.claims, { ...claim }] });
              setClaim({ ...claim, text: "" });
              setMessage("Claim added to draft; save revision to persist.");
            }}
          >
            Add claim to draft
          </button>
        </div>
      </fieldset>
      <fieldset>
        <legend>Add explicit role permission</legend>
        <div className="r-form">
          <label>
            Role
            <select
              value={right.role}
              onChange={(e) => setRight({ ...right, role: e.target.value })}
            >
              {codebook.targetRoles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            Permission
            <select
              value={right.permission}
              onChange={(e) =>
                setRight({
                  ...right,
                  permission: e.target.value as typeof right.permission,
                })
              }
            >
              {["propose", "edit", "approve", "validate", "not_reported"].map(
                (r) => (
                  <option key={r}>{r}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Decision type
            <input
              value={right.decisionType}
              onChange={(e) =>
                setRight({ ...right, decisionType: e.target.value })
              }
            />
          </label>
          <label>
            Evidence note
            <textarea
              value={right.evidenceNote}
              onChange={(e) =>
                setRight({ ...right, evidenceNote: e.target.value })
              }
            />
          </label>
          <label>
            Source URL
            <input
              type="url"
              value={right.sourceUrl}
              onChange={(e) =>
                setRight({ ...right, sourceUrl: e.target.value })
              }
            />
          </label>
          <label>
            Locator
            <input
              value={right.locator}
              onChange={(e) => setRight({ ...right, locator: e.target.value })}
            />
          </label>
          <button
            onClick={() => {
              if (
                !right.evidenceNote.trim() ||
                !right.locator.trim() ||
                !/^https?:\/\//.test(right.sourceUrl)
              ) {
                setMessage(
                  "Permission requires evidence note, URL and locator.",
                );
                return;
              }
              patch({ designRights: [...draft.designRights, { ...right }] });
              setMessage("Permission added to draft.");
            }}
          >
            Add permission to draft
          </button>
        </div>
      </fieldset>
      <p>
        Draft claims: {draft.claims.length} · permissions:{" "}
        {draft.designRights.length}
      </p>
      {draft.claims.map((c, i) => (
        <p key={i}>
          {c.text}{" "}
          <button
            onClick={() =>
              patch({ claims: draft.claims.filter((_, j) => j !== i) })
            }
          >
            Remove draft claim {i + 1}
          </button>
        </p>
      ))}
      {draft.designRights.map((r, i) => (
        <p key={i}>
          {r.role} · {r.permission} · {r.evidenceNote}{" "}
          <button
            onClick={() =>
              patch({
                designRights: draft.designRights.filter((_, j) => j !== i),
              })
            }
          >
            Remove draft permission {i + 1}
          </button>
        </p>
      ))}
      <label>
        Limitations (one per line)
        <textarea
          value={draft.limitations.join("\n")}
          onChange={(e) => patch({ limitations: e.target.value.split("\n") })}
        />
      </label>
      <label>
        Relevance to Studio
        <textarea
          value={draft.relevanceToStudio}
          onChange={(e) => patch({ relevanceToStudio: e.target.value })}
        />
      </label>
      <button
        onClick={() => {
          const next = {
            ...data,
            coding: [
              ...data.coding,
              { ...draft, id: crypto.randomUUID(), updatedAt: today() },
            ],
          };
          try {
            parseResearch(JSON.stringify(next));
            save(next);
            setMessage("Coding revision appended.");
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        Save coding revision
      </button>
      <p role="status">{message}</p>
    </div>
  );
}
function Methods({
  data,
  save,
}: {
  data: ResearchDataset;
  save: (d: ResearchDataset) => void;
}) {
  const [from, setFrom] = useState(data.searchWindow.from),
    [to, setTo] = useState(data.searchWindow.to);
  const [error, setError] = useState("");
  return (
    <>
      <h2>Methods & source ledger</h2>
      <p>
        Clinical-to-Textile Translation: A Scoping Review and Design Atlas of
        Authoring Tools for Soft Sensors.
      </p>
      <p>
        This is a seed corpus and ongoing review workspace. Formal ACM DL, IEEE
        Xplore, Scopus and PubMed database searches have not been executed here.
        No hit counts, agreement metrics, exhaustive gaps or completed
        PRISMA-ScR flow are claimed.
      </p>
      <div className="r-card">
        <h3>Protocol {data.protocolVersion} · review window</h3>
        <div className="r-form">
          <label>
            Start
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            End
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button
            onClick={() => {
              try {
                const n = { ...data, searchWindow: { from, to } };
                parseResearch(JSON.stringify(n));
                save(n);
                setError(
                  "Window saved. Historical search runs retain their original scope.",
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Save review window
          </button>
        </div>
        <p role="status">{error}</p>
        <h4>Research questions</h4>
        <ol>
          <li>
            How do tools represent structures, materials, sensing, circuits and
            fabrication constraints?
          </li>
          <li>
            Which decisions can clinicians, engineers, designers and end users
            make?
          </li>
          <li>
            How do situated needs become editable specifications and prototypes?
          </li>
          <li>
            How are sensing, continuity, feasibility, usability and clinical
            relevance evaluated?
          </li>
          <li>
            Which capabilities and handoffs need further study after screening
            and coding?
          </li>
        </ol>
        <h4>Eligibility</h4>
        <p>
          Include primary HCI research, authoring tools, substantive textile
          fabrication/sensing workflows and participatory wearable design.
          Exclude or separately tag pure material tests without authoring
          workflows, products, duplicate versions and unrelated wearables.
          Project pages and preprints remain distinct source types.
        </p>
        <p>
          Two reviewers may append independent decisions using separate IDs.
          Disagreements remain visible; reconciliation must be documented
          explicitly. Full-text inclusion requires a recorded full-text
          decision, not bibliographic verification.
        </p>
      </div>
      <div className="r-card">
        <h3>Codebook 1.0</h3>
        <p>
          Codes describe reported methods and editable decisions. Empty arrays
          mean unknown / not coded. “Not reported” is a reading outcome, not
          evidence that a capability is impossible. A target role does not
          confer an authoring right.
        </p>
        {Object.entries(codebook).map(([k, v]) => (
          <p key={k}>
            <strong>{label(k)}</strong>: {v.map(label).join(" · ")}
          </p>
        ))}
        <p>
          Fabrication maturity: concept → visual preview → fabrication export →
          fabricated → bench validated → clinical evaluated. These categories
          describe evidence reported in a source; they do not certify this
          application. Unknown stays explicit.
        </p>
        <p>
          Claims: directly reported = source explicitly states the observation;
          interpretation = reviewer synthesis; hypothesis = untested proposal.
          Every atlas observation requires a URL and locator. Seed notes are
          preliminary source-page observations, not completed full-text coding.
        </p>
      </div>
      <div className="r-card">
        <h3>Search-run audit ledger</h3>
        <p>
          Exact recorded discovery queries below. Protocol window is reported
          separately from engine filters. Count “not recorded” means no
          count-bearing export, never zero.
        </p>
        {data.searchRuns.map((r) => (
          <details key={r.id}>
            <summary>
              {r.queryDate} · {r.sourceDatabase} · {r.exactQuery}
            </summary>
            <p>
              Scope: {r.searchWindow.from}–{r.searchWindow.to} · Results:{" "}
              {r.resultCount ?? "not recorded"} · Imported:{" "}
              {r.importedCount ?? "not recorded"}
            </p>
            <p>{r.notes}</p>
          </details>
        ))}
        <SearchForm data={data} save={save} />
      </div>
      <div className="r-card">
        <h3>Material references · outside paper counts</h3>
        {data.materialReferences.map((r) => (
          <div key={r.id}>
            <h4>
              <Source url={r.sourceUrl}>{r.name}</Source>
            </h4>
            <p>
              {r.type} · {r.verificationStatus}
            </p>
            <p>{r.attribution}</p>
            <p>{r.reuseNotes}</p>
          </div>
        ))}
      </div>
      <div className="r-card">
        <h3>Persistence, migration & limitations</h3>
        <p>
          Research schema version 1 uses its own browser storage key. CAD schema
          and projects are unchanged. JSON backups contain reviewer history and
          provenance. Unknown future schema versions are rejected; keep the
          original export for an explicit future migration. CSV imports are
          candidates requiring verification. Import preview is reversible until
          confirmed; JSON restore replaces only Research data.
        </p>
        <p>
          No PDFs, paper figures or participant data are stored. Bibliographic
          checks use publisher, Crossref or institutional sources; incomplete
          retrieval is documented per candidate. Local annotations are not
          synced or peer reviewed. Requirements are research hypotheses, not
          medical or machine compatibility guidance.
        </p>
      </div>
    </>
  );
}
function SearchForm({
  data,
  save,
}: {
  data: ResearchDataset;
  save: (d: ResearchDataset) => void;
}) {
  const [message, setMessage] = useState("");
  return (
    <form
      className="r-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const count = String(f.get("count")).trim();
        const run = {
          id: crypto.randomUUID(),
          sourceDatabase: String(f.get("source")),
          exactQuery: String(f.get("query")),
          queryDate: String(f.get("date")),
          searchWindow: { ...data.searchWindow },
          notes: String(f.get("notes")),
          ...(count ? { resultCount: Number(count) } : {}),
        };
        const next = { ...data, searchRuns: [...data.searchRuns, run] };
        try {
          parseResearch(JSON.stringify(next));
          save(next);
          setMessage("Search run appended.");
        } catch (e) {
          setMessage((e as Error).message);
        }
      }}
    >
      <h4 className="r-wide">Record an actual search run</h4>
      <label>
        Database / source
        <input name="source" required />
      </label>
      <label>
        Retrieval date
        <input name="date" type="date" required defaultValue={today()} />
      </label>
      <label className="r-wide">
        Exact executed query
        <textarea name="query" required />
      </label>
      <label>
        Result count (only from actual export)
        <input name="count" type="number" min="0" step="1" />
      </label>
      <label>
        Export provenance / reviewer notes
        <textarea name="notes" required />
      </label>
      <button>Append search run</button>
      <p role="status">{message}</p>
    </form>
  );
}
