import { useMemo, useState } from "react";
import type { EditorContext, JsonValue, SelectedWorld, WorldBundleData } from "./types";
import "./WorldBundlePage.css";

export const WORLD_SECTIONS = ["locations", "landmarks", "characters", "background_characters", "items", "item_stacks", "equipment", "containers", "turns", "events", "memories", "intents", "entity_relationships", "subjective_entity_claims", "entity_variable_sets"] as const;
export const WORLD_CONFIGS = ["chat", "embed", "image", "tts"] as const;
export type WorldPageKey = "world-overview" | "world-details" | `world-section:${typeof WORLD_SECTIONS[number]}` | `world-config:${typeof WORLD_CONFIGS[number]}` | "world-prompts" | "world-workflows" | "world-media";

const title = (key: string) => key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const newId = () => globalThis.crypto?.randomUUID?.() ?? `world-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const clone = <T,>(value: T): T => structuredClone(value);

function ScalarFields({ value, path, onChange, onContext }: { value: Record<string, JsonValue>; path: string; onChange: (value: Record<string, JsonValue>) => void; onContext: (value: EditorContext) => void }) {
  return <div className="world-fields">{Object.entries(value).map(([key, field]) => {
    const fieldPath = `${path}.${key}`;
    if (key === "id" || key === "creation_time" || key === "version" && path === "world") return <label key={key}>{title(key)}<input value={String(field ?? "")} readOnly aria-readonly="true" /></label>;
    if (typeof field === "boolean") return <label className="world-check" key={key}><input type="checkbox" checked={field} onChange={(event) => onChange({ ...value, [key]: event.target.checked })} />{title(key)}</label>;
    if (typeof field === "number") return <label key={key}>{title(key)}<input type="number" value={field} onFocus={() => onContext({ path: fieldPath, selectedText: null, cursor: null })} onChange={(event) => onChange({ ...value, [key]: Number(event.target.value) })} /></label>;
    if (typeof field === "string" || field === null) {
      const long = typeof field === "string" && (field.length > 100 || /description|content|prompt|notes|plan|conditions|constraints/.test(key));
      return <label key={key}>{title(key)}{long ? <textarea rows={5} value={field ?? ""} onFocus={() => onContext({ path: fieldPath, selectedText: field || null, cursor: null })} onChange={(event) => onChange({ ...value, [key]: event.target.value })} /> : <input value={field ?? ""} onFocus={() => onContext({ path: fieldPath, selectedText: field || null, cursor: null })} onChange={(event) => onChange({ ...value, [key]: event.target.value })} />}</label>;
    }
    if (Array.isArray(field) && field.every((item) => typeof item === "string")) return <label key={key}>{title(key)}<textarea rows={3} value={field.join("\n")} onFocus={() => onContext({ path: fieldPath, selectedText: null, cursor: null })} onChange={(event) => onChange({ ...value, [key]: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} /><small>One value per line</small></label>;
    if (field && typeof field === "object" && !Array.isArray(field)) return <fieldset key={key}><legend>{title(key)}</legend><ScalarFields value={field as Record<string, JsonValue>} path={fieldPath} onContext={onContext} onChange={(nested) => onChange({ ...value, [key]: nested })} /></fieldset>;
    return <div className="world-unsupported" key={key}><strong>{title(key)}</strong><span>Preserved by the editor</span></div>;
  })}</div>;
}

function CollectionEditor({ label, rows, path, onChange, onContext }: { label: string; rows: Array<Record<string, JsonValue>>; path: string; onChange: (rows: Array<Record<string, JsonValue>>) => void; onContext: (value: EditorContext) => void }) {
  const [selected, setSelected] = useState(0);
  const row = rows[selected];
  const add = () => { const next = [...rows, { id: newId(), name: `New ${label.replace(/s$/, "")}` }]; onChange(next); setSelected(next.length - 1); };
  return <div className="world-collection"><aside><button className="primary" onClick={add}>Add {label.replace(/s$/, "")}</button>{rows.map((item, index) => <button className={index === selected ? "active" : ""} key={String(item.id ?? index)} onClick={() => setSelected(index)}><strong>{String(item.name ?? item.title ?? item.id ?? `${label} ${index + 1}`)}</strong><small>{String(item.id ?? "")}</small></button>)}</aside><section>{row ? <><header><h2>{String(row.name ?? row.title ?? `${label} ${selected + 1}`)}</h2><div><button className="secondary" onClick={() => { const next = [...rows]; next.splice(selected + 1, 0, { ...clone(row), id: newId() }); onChange(next); setSelected(selected + 1); }}>Duplicate</button><button className="danger-button" onClick={() => { onChange(rows.filter((_, index) => index !== selected)); setSelected(Math.max(0, selected - 1)); }}>Remove</button></div></header><ScalarFields value={row} path={`${path}.${String(row.id ?? selected)}`} onContext={onContext} onChange={(next) => onChange(rows.map((item, index) => index === selected ? next : item))} /></> : <div className="world-empty">No {label.toLowerCase()} yet.</div>}</section></div>;
}

export function reviewWorld(data: WorldBundleData) {
  const findings: Array<{ severity: "error" | "warning"; path: string; message: string }> = [];
  for (const key of ["id", "name", "starting_time", "language"]) if (!data.world[key]) findings.push({ severity: "error", path: `world.${key}`, message: `${title(key)} is required.` });
  if (data.spec !== "wse_world" || data.specVersion !== "1.0") findings.push({ severity: "error", path: "spec", message: "Only wse_world v1.0 is supported." });
  if (data.world.language !== "en" && data.world.language !== "zh") findings.push({ severity: "error", path: "world.language", message: "Language must be en or zh." });
  if (typeof data.world.starting_time === "string" && Number.isNaN(Date.parse(data.world.starting_time))) findings.push({ severity: "error", path: "world.starting_time", message: "Starting time is not a valid date and time." });
  const ids = new Set<string>();
  for (const section of WORLD_SECTIONS) for (const [index, row] of (data.sections[section] ?? []).entries()) { const id = typeof row.id === "string" ? row.id : ""; if (!id) findings.push({ severity: "error", path: `sections.${section}.${index}.id`, message: `${title(section)} row ${index + 1} has no ID.` }); else if (ids.has(id) || id === data.world.id) findings.push({ severity: "error", path: `sections.${section}.${id}.id`, message: `Duplicate graph ID: ${id}` }); else ids.add(id); if ("description" in row && !String(row.description ?? "").trim()) findings.push({ severity: "warning", path: `sections.${section}.${id}.description`, message: `${title(section)} row ${index + 1} has an empty description.` }); }
  return findings;
}

export function WorldBundlePage({ selected, page, dirty, status, onChange, onSave, onContext, onNavigate, onDraft }: { selected: SelectedWorld; page: WorldPageKey; dirty: boolean; status: string; onChange: (value: WorldBundleData) => void; onSave: () => void; onContext: (value: EditorContext) => void; onNavigate: (page: WorldPageKey) => void; onDraft: () => void }) {
  const data = selected.draft?.data;
  const findings = useMemo(() => data ? reviewWorld(data) : [], [data]);
  if (!data) return <section className="world-page"><h1>World bundle</h1><p>This World does not have draft data.</p></section>;
  const shell = (heading: string, intro: string, body: React.ReactNode) => <section className="world-page"><header className="world-page-heading"><div><p>{selected.resource.metadata.name}</p><h1>{heading}</h1><span>{intro}</span></div><div><button className="secondary" onClick={onDraft}>Co-author</button><button className="primary" disabled={!dirty || status === "saving"} onClick={onSave}>{status === "saving" ? "Saving…" : "Save World"}</button></div></header>{body}</section>;
  if (page === "world-overview") return shell("World overview and review", "Review the complete WorldSE bundle before export or publication.", <><div className="metric-grid"><article><span>Graph records</span><strong>{Object.values(data.sections).reduce((sum, rows) => sum + rows.length, 0)}</strong></article><article><span>Characters</span><strong>{(data.sections.characters?.length ?? 0) + (data.sections.background_characters?.length ?? 0)}</strong></article><article><span>Prompts</span><strong>{data.prompts.length}</strong></article><article><span>Findings</span><strong>{findings.length}</strong></article></div><section className="world-review"><h2>Deterministic review</h2>{findings.length ? findings.map((finding) => <button key={`${finding.path}-${finding.message}`} onClick={() => { onContext({ path: finding.path, selectedText: null, cursor: null }); const match = finding.path.match(/^sections\.([^.]+)/); onNavigate(match ? `world-section:${match[1]}` as WorldPageKey : "world-details"); }}><b className={finding.severity}>{finding.severity === "error" ? "!" : "△"}</b><span>{finding.message}<small>{finding.path}</small></span></button>) : <p>No structural problems found.</p>}</section><section className="world-summary"><h2>Bundle contents</h2>{WORLD_SECTIONS.map((section) => <button key={section} onClick={() => onNavigate(`world-section:${section}`)}><span>{title(section)}</span><strong>{data.sections[section]?.length ?? 0}</strong></button>)}</section></>);
  if (page === "world-details") return shell("World and author", "Edit the root simulation settings and human-facing provenance.", <><section className="world-panel"><h2>World</h2><ScalarFields value={data.world} path="world" onContext={onContext} onChange={(world) => onChange({ ...data, world })} /></section><section className="world-panel"><header><h2>Author</h2>{!data.author && <button onClick={() => onChange({ ...data, author: { id: newId(), name: "", url: "" } })}>Add author</button>}</header>{data.author && <ScalarFields value={data.author} path="author" onContext={onContext} onChange={(author) => onChange({ ...data, author })} />}</section></>);
  const section = page.startsWith("world-section:") ? page.slice(14) : null;
  if (section) return shell(title(section), `Edit the WorldSE ${title(section).toLowerCase()} collection.`, <CollectionEditor label={title(section)} rows={data.sections[section] ?? []} path={`sections.${section}`} onContext={onContext} onChange={(rows) => onChange({ ...data, sections: { ...data.sections, [section]: rows } })} />);
  const config = page.startsWith("world-config:") ? page.slice(13) : null;
  if (config) return shell(`${title(config)} configuration`, "Connection credentials are not stored in World bundles.", <CollectionEditor label={`${title(config)} assignments`} rows={data.configs[config] ?? []} path={`configs.${config}`} onContext={onContext} onChange={(rows) => onChange({ ...data, configs: { ...data.configs, [config]: rows } })} />);
  if (page === "world-prompts") return shell("Prompts", "Edit named simulator prompts without provider credentials.", <CollectionEditor label="Prompts" rows={data.prompts} path="prompts" onContext={onContext} onChange={(prompts) => onChange({ ...data, prompts })} />);
  if (page === "world-workflows") return shell("Image workflows", "Edit WorldSE image workflow definitions.", <CollectionEditor label="Workflows" rows={data.workflows} path="workflows" onContext={onContext} onChange={(workflows) => onChange({ ...data, workflows })} />);
  return shell("Media references", "Review media manifest records and their catalogue image links.", <CollectionEditor label="Media" rows={data.media.map((item) => ({ ...item.record, id: item.mediaId, imageResourceId: item.imageResourceId }))} path="media" onContext={onContext} onChange={(rows) => onChange({ ...data, media: rows.map((row) => ({ mediaId: String(row.id), imageResourceId: typeof row.imageResourceId === "string" ? row.imageResourceId : null, record: Object.fromEntries(Object.entries(row).filter(([key]) => key !== "imageResourceId")) })) })} />);
}
