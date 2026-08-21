import { useEffect, useMemo, useState } from "react";
import { exportResourceDraft, listResourceVersions, previewResourceDraft, publishResource, saveResourceMetadata } from "./backend";
import type { MessageKey } from "./i18n";
import { estimateTokens } from "./OverviewPage";
import type { CatalogueResource, JsonValue, LorebookEntry, ResourceMetadata, ResourceVersionSummary, SelectedLorebook } from "./types";
import "./LorebookOverviewPage.css";

type Diagnostic = { level: "error" | "warning"; entry: number; message: MessageKey };
const regexValid = (pattern: string) => { try { const literal = pattern.startsWith("/") ? pattern.match(/^\/(.*)\/([a-z]*)$/s) : null; new RegExp(literal ? literal[1] : pattern, literal ? literal[2] : ""); return true; } catch { return false; } };
const unique = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];

function diagnostics(entries: LorebookEntry[]): Diagnostic[] {
  return entries.flatMap((entry, index) => {
    const issues: Diagnostic[] = [];
    if (entry.enabled && !entry.content.trim()) issues.push({ level: "error", entry: index, message: "emptyLoreContent" });
    if (entry.enabled && !entry.constant && entry.keys.length === 0) issues.push({ level: "warning", entry: index, message: "missingActivationKeys" });
    if (entry.selective && !(entry.secondary_keys ?? []).length) issues.push({ level: "error", entry: index, message: "missingSecondaryKeys" });
    if (entry.use_regex && [...entry.keys, ...(entry.secondary_keys ?? [])].some((key) => !regexValid(key))) issues.push({ level: "error", entry: index, message: "invalidRegexKey" });
    return issues;
  });
}

export function LorebookOverviewPage({ selected, dirty, onEdit, onChangeResource, onResource, t }: {
  selected: SelectedLorebook;
  dirty: boolean;
  onEdit: () => void;
  onChangeResource: () => void;
  onResource: (resource: CatalogueResource) => void;
  t: (key: MessageKey) => string;
}) {
  const [metadata, setMetadata] = useState<ResourceMetadata>(selected.resource.metadata);
  const [metadataStatus, setMetadataStatus] = useState<"idle" | "saving" | "saved" | "error" | "conflict">("idle");
  const [versions, setVersions] = useState<ResourceVersionSummary[]>([]);
  const [preview, setPreview] = useState<JsonValue | null>(null);
  const [releaseVersion, setReleaseVersion] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  const [releaseStatus, setReleaseStatus] = useState<"idle" | "previewing" | "exporting" | "publishing" | "error">("idle");
  const [releaseError, setReleaseError] = useState("");
  useEffect(() => { setMetadata(selected.resource.metadata); setMetadataStatus("idle"); }, [selected.resource.id, selected.resource.revision]);
  useEffect(() => { let active = true; if (selected.resource.storageMode !== "local") void listResourceVersions(selected.resource.id).then((items) => active && setVersions(items)).catch(() => undefined); return () => { active = false; }; }, [selected.resource.id, selected.resource.storageMode]);
  const book = selected.draft?.data ?? null;
  const issues = useMemo(() => diagnostics(book?.entries ?? []), [book]);
  const errors = issues.filter((issue) => issue.level === "error").length;
  const warnings = issues.length - errors;
  const tokens = (book?.entries ?? []).reduce((sum, entry) => sum + estimateTokens(entry.content), 0);
  const enabled = (book?.entries ?? []).filter((entry) => entry.enabled).length;
  const constant = (book?.entries ?? []).filter((entry) => entry.constant).length;
  const regex = (book?.entries ?? []).filter((entry) => entry.use_regex).length;
  const saveMetadata = async () => { setMetadataStatus("saving"); try { const outcome = await saveResourceMetadata(selected.resource.id, metadata, selected.resource.revision); if (outcome.saved) { onResource(outcome.saved); setMetadataStatus("saved"); } else if (outcome.current) { onResource(outcome.current); setMetadata(outcome.current.metadata); setMetadataStatus("conflict"); } } catch { setMetadataStatus("error"); } };
  const loadPreview = async () => { setReleaseStatus("previewing"); setReleaseError(""); try { setPreview(await previewResourceDraft(selected.resource.id)); setReleaseStatus("idle"); } catch (error) { setReleaseError(String(error)); setReleaseStatus("error"); } };
  const exportDraft = async () => { setReleaseStatus("exporting"); setReleaseError(""); try { const artifact = await exportResourceDraft(selected.resource.id); const binary = atob(artifact.data); const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0)); const url = URL.createObjectURL(new Blob([bytes], { type: artifact.mediaType })); const link = document.createElement("a"); link.href = url; link.download = artifact.fileName; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setReleaseStatus("idle"); } catch (error) { setReleaseError(String(error)); setReleaseStatus("error"); } };
  const publish = async () => { setReleaseStatus("publishing"); setReleaseError(""); try { const version = await publishResource(selected.resource.id, releaseVersion); setVersions((items) => [version, ...items]); setReleaseVersion(""); setPublishOpen(false); setReleaseStatus("idle"); } catch (error) { setReleaseError(String(error)); setReleaseStatus("error"); } };
  const previewBook = preview && typeof preview === "object" && !Array.isArray(preview) ? ((preview as Record<string, JsonValue>).data ?? preview) as Record<string, JsonValue> : null;
  const previewEntries = Array.isArray(previewBook?.entries) ? previewBook.entries : [];
  return <section className="lorebook-overview">
    <header><div><p>{selected.resource.metadata.name}</p><h1>{t("lorebookOverview")}</h1><span>{t("lorebookOverviewIntro")}</span></div><div><button className="secondary" onClick={onChangeResource}>{t("changeResource")}</button><button className="primary" onClick={onEdit}>{t("editLorebook")}</button></div></header>
    <div className="metric-grid"><article><span>{t("loreEntries")}</span><strong>{book?.entries.length ?? 0}</strong></article><article><span>{t("enabledEntries")}</span><strong>{enabled}</strong></article><article><span>{t("approximateTokens")}</span><strong>{tokens.toLocaleString()}</strong></article><article><span>{t("reviewDiagnostics")}</span><strong>{errors} / {warnings}</strong><small>{t("errors")} / {t("warnings")}</small></article></div>
    <section className="review-panel"><header><div><h2>{t("lorebookDiagnostics")}</h2><p>{t("lorebookReviewHint")}</p></div><div className="review-counts"><span className={errors ? "has-errors" : ""}>{errors} {t("errors")}</span><span className={warnings ? "has-warnings" : ""}>{warnings} {t("warnings")}</span></div></header>{issues.length ? <div className="review-issues">{issues.map((issue, index) => <button key={`${issue.entry}-${issue.message}-${index}`} onClick={onEdit}><span className={`review-severity ${issue.level}`}>{issue.level === "error" ? "!" : "△"}</span><span><strong>{t(issue.message)}</strong><small>{t("entry")} {issue.entry + 1}</small></span><em>{t("openEditor")}</em></button>)}</div> : <div className="review-ready"><strong>{t("noLorebookProblems")}</strong><p>{t("noReviewProblemsDetail")}</p></div>}<footer><span>{t("constantEntry")}: {constant}</span><span>{t("regexKeys")}: {regex}</span></footer></section>
    <section className="review-panel metadata-panel"><header><div><h2>{t("resourceMetadataTitle")}</h2><p>{t("resourceMetadataHint")}</p></div></header><div className="lorebook-metadata-grid"><label>{t("name")}<input value={metadata.name} onChange={(event) => { setMetadata({ ...metadata, name: event.target.value }); setMetadataStatus("idle"); }} /></label><label>{t("contentLanguage")}<select value={metadata.language} onChange={(event) => { setMetadata({ ...metadata, language: event.target.value as ResourceMetadata["language"] }); setMetadataStatus("idle"); }}><option value="en-uk">{t("languageEnUK")}</option><option value="zh-cn">{t("languageZhCN")}</option></select></label><label>{t("visibility")}<select value={metadata.visibility} onChange={(event) => { setMetadata({ ...metadata, visibility: event.target.value as ResourceMetadata["visibility"] }); setMetadataStatus("idle"); }}><option value="private">{t("private")}</option><option value="authenticated">{t("authenticated")}</option><option value="public">{t("public")}</option></select></label><label>{t("tags")}<input value={metadata.tags.join(", ")} onChange={(event) => { setMetadata({ ...metadata, tags: unique(event.target.value.split(",")) }); setMetadataStatus("idle"); }} /></label><label className="wide">{t("description")}<textarea rows={4} value={metadata.description} onChange={(event) => { setMetadata({ ...metadata, description: event.target.value }); setMetadataStatus("idle"); }} /></label></div><footer><span>{metadataStatus === "saved" ? t("resourceMetadataSaved") : metadataStatus === "conflict" ? t("resourceMetadataConflict") : metadataStatus === "error" ? t("resourceMetadataError") : ""}</span><button className="primary" disabled={metadataStatus === "saving" || !metadata.name.trim()} onClick={() => void saveMetadata()}>{metadataStatus === "saving" ? t("saving") : t("saveResourceMetadata")}</button></footer></section>
    <section className="review-panel release-panel"><header><div><h2>{t("releaseAndExport")}</h2><p>{t("lorebookReleaseHint")}</p></div><div className="release-actions"><button className="secondary" disabled={dirty || releaseStatus !== "idle"} onClick={() => void loadPreview()}>{releaseStatus === "previewing" ? t("previewing") : t("previewLorebook")}</button><button className="secondary" disabled={dirty || releaseStatus !== "idle"} onClick={() => void exportDraft()}>{releaseStatus === "exporting" ? t("exporting") : t("exportDraft")}</button><button className="primary" disabled={dirty || errors > 0 || releaseStatus !== "idle" || !book} onClick={() => setPublishOpen(true)}>{t("publishRelease")}</button></div></header>{dirty && <p className="release-blocker">{t("unsavedReleaseBlock")}</p>}{releaseError && <p className="release-blocker" role="alert">{releaseError}</p>}<div className="collection-list"><div><dt>{t("publishedReleases")}</dt><dd>{versions.length}</dd></div>{versions[0] && <div><dt>{t("latestRelease")}</dt><dd>{versions[0].version}</dd></div>}</div></section>
    {previewBook && <div className="confirmation-layer" onMouseDown={(event) => event.target === event.currentTarget && setPreview(null)}><section className="confirmation-dialog lorebook-preview" role="dialog" aria-modal="true"><h2>{String(previewBook.name ?? metadata.name)}</h2><p>{String(previewBook.description ?? "")}</p><div>{previewEntries.map((raw, index) => { const entry = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, JsonValue> : {}; return <article key={index}><strong>{String(entry.name ?? entry.comment ?? `${t("entry")} ${index + 1}`)}</strong><small>{Array.isArray(entry.keys) ? entry.keys.join(", ") : ""}</small><p>{String(entry.content ?? "")}</p></article>; })}</div><footer><button className="primary" onClick={() => setPreview(null)}>{t("close")}</button></footer></section></div>}
    {publishOpen && <div className="confirmation-layer"><section className="confirmation-dialog" role="dialog" aria-modal="true"><h2>{t("publishRelease")}</h2><p>{t("publishReleaseHint")}</p><label>{t("releaseVersionLabel")}<input autoFocus value={releaseVersion} onChange={(event) => setReleaseVersion(event.target.value)} /></label><div><button className="secondary" onClick={() => setPublishOpen(false)}>{t("cancel")}</button><button className="primary" disabled={!releaseVersion.trim() || releaseStatus === "publishing"} onClick={() => void publish()}>{releaseStatus === "publishing" ? t("publishing") : t("publishRelease")}</button></div></section></div>}
  </section>;
}
