import type { MessageKey } from "./i18n";
import { useEffect, useState } from "react";
import { exportResourceDraft, listResourceVersions, previewResourceDraft, publishResource } from "./backend";
import type { CharacterCardV3Data, CharacterDraft, EditorContext, JsonValue, LorebookEntry, ResourceVersionSummary, SelectedCharacter } from "./types";
import "./OverviewPage.css";

type FieldKey = "name" | "description" | "personality" | "scenario" | "first_mes" | "mes_example" | "creator_notes" | "system_prompt" | "post_history_instructions" | "creator" | "character_version";
type ReviewPage = "foundation" | "scenes" | "dialogue" | "runtime" | "metadata" | "lorebook" | "extensions" | "assets";
export type ReviewIssue = { severity: "error" | "warning"; title: MessageKey; detail: string; page: ReviewPage; path: string };

const fields: Array<{ key: FieldKey; label: MessageKey }> = [
  { key: "name", label: "name" }, { key: "description", label: "description" },
  { key: "personality", label: "personality" }, { key: "scenario", label: "scenario" },
  { key: "first_mes", label: "firstMessage" }, { key: "mes_example", label: "exampleDialogue" },
  { key: "creator_notes", label: "creatorNotes" }, { key: "system_prompt", label: "systemPrompt" },
  { key: "post_history_instructions", label: "postHistory" }, { key: "creator", label: "creator" },
  { key: "character_version", label: "characterVersion" },
];

export function estimateTokens(text: string): number {
  if (!text.trim()) return 0;
  const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) ?? []).length;
  const remainder = text.replace(/[\u3400-\u9fff\uf900-\ufaff]/g, " ");
  const words = remainder.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
  const punctuation = remainder.match(/[^\s\p{L}\p{N}]/gu)?.length ?? 0;
  return Math.max(1, Math.ceil(cjk * 1.05 + words * 1.3 + punctuation * 0.35));
}

function objectValue(value: unknown): Record<string, JsonValue> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, JsonValue> : null;
}

function arrayValue(value: JsonValue | undefined): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

export function cardStatistics(card: CharacterCardV3Data) {
  const fieldRows = fields.map(({ key, label }) => {
    const rawValue = card[key];
    const value = typeof rawValue === "string" ? rawValue : "";
    return { key, label, value, tokens: estimateTokens(value), filled: Boolean(value.trim()) };
  });
  const book = objectValue(card.character_book);
  const entries = arrayValue(book?.entries);
  const typeCounts = new Map<string, number>();
  for (const rawEntry of entries) {
    const entry = objectValue(rawEntry);
    const type = typeof entry?.type === "string" && entry.type.trim() ? entry.type : "untyped";
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  }
  const regexCount = arrayValue(card.extensions?.regex_scripts as unknown as JsonValue).length;
  const helper = objectValue(card.extensions?.tavern_helper as unknown as JsonValue);
  const scriptCount = arrayValue(helper?.scripts).length;
  const alternateCount = Array.isArray(card.alternate_greetings) ? card.alternate_greetings.length : 0;
  const totalTokens = fieldRows.reduce<number>((sum, field) => sum + field.tokens, 0)
    + entries.reduce<number>((sum, entry) => sum + estimateTokens(JSON.stringify(entry)), 0);
  return { fieldRows, entries, typeCounts, regexCount, scriptCount, alternateCount, totalTokens };
}

const validRegex = (pattern: string) => { try { const literal = pattern.startsWith("/") ? pattern.match(/^\/(.*)\/([a-z]*)$/s) : null; new RegExp(literal ? literal[1] : pattern, literal ? literal[2] : ""); return true; } catch { return false; } };

export function reviewCard(card: CharacterCardV3Data, t: (key: MessageKey) => string): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const required: Array<[FieldKey, MessageKey, ReviewPage]> = [["name", "name", "foundation"], ["description", "description", "foundation"], ["first_mes", "firstMessage", "scenes"]];
  required.forEach(([key, label, page]) => { if (!card[key]?.trim()) issues.push({ severity: "error", title: "requiredFieldEmpty", detail: t(label), page, path: key }); });
  const recommended: Array<[FieldKey, MessageKey, ReviewPage]> = [["personality", "personality", "foundation"], ["scenario", "scenario", "scenes"], ["mes_example", "exampleDialogue", "dialogue"], ["creator", "creator", "metadata"], ["character_version", "characterVersion", "metadata"]];
  recommended.forEach(([key, label, page]) => { if (!card[key]?.trim()) issues.push({ severity: "warning", title: "recommendedFieldEmpty", detail: t(label), page, path: key }); });
  if (!card.tags?.length) issues.push({ severity: "warning", title: "missingCardTags", detail: t("missingCardTagsDetail"), page: "metadata", path: "tags" });
  (card.alternate_greetings ?? []).forEach((value, index) => { if (!value.trim()) issues.push({ severity: "error", title: "emptyGreeting", detail: `${t("alternateOpenings")} ${index + 1}`, page: "scenes", path: `alternate_greetings.${index}` }); });
  (card.group_only_greetings ?? []).forEach((value, index) => { if (!value.trim()) issues.push({ severity: "error", title: "emptyGreeting", detail: `${t("groupOpenings")} ${index + 1}`, page: "scenes", path: `group_only_greetings.${index}` }); });
  if (card.mes_example?.trim() && !/(?:^|\n)\s*<START>\s*(?:\n|$)/i.test(card.mes_example)) issues.push({ severity: "warning", title: "dialogueBoundaryMissing", detail: t("dialogueBoundaryMissingDetail"), page: "dialogue", path: "mes_example" });
  const entries = card.character_book?.entries ?? [];
  const keyOwners = new Map<string, number>();
  entries.forEach((entry: LorebookEntry, index) => {
    const label = entry.name?.trim() || `${t("entry")} ${index + 1}`;
    if (entry.enabled && !entry.content.trim()) issues.push({ severity: "error", title: "emptyLoreContent", detail: label, page: "lorebook", path: `character_book.entries.${index}.content` });
    if (entry.enabled && !entry.constant && entry.keys.length === 0) issues.push({ severity: "warning", title: "missingActivationKeys", detail: label, page: "lorebook", path: `character_book.entries.${index}.keys` });
    if (entry.selective && !(entry.secondary_keys ?? []).length) issues.push({ severity: "error", title: "missingSecondaryKeys", detail: label, page: "lorebook", path: `character_book.entries.${index}.secondary_keys` });
    if (entry.use_regex && [...entry.keys, ...(entry.secondary_keys ?? [])].some((key) => !validRegex(key))) issues.push({ severity: "error", title: "invalidRegexKey", detail: label, page: "lorebook", path: `character_book.entries.${index}.keys` });
    if (!entry.use_regex) entry.keys.forEach((key) => { const normalised = key.trim().toLocaleLowerCase(); const owner = keyOwners.get(normalised); if (normalised && owner !== undefined) issues.push({ severity: "warning", title: "duplicateLoreKey", detail: `${key} — ${t("entry")} ${owner + 1}, ${t("entry")} ${index + 1}`, page: "lorebook", path: `character_book.entries.${index}.keys` }); else if (normalised) keyOwners.set(normalised, index); });
  });
  const loreTokens = entries.reduce((sum, entry) => sum + estimateTokens(entry.content), 0);
  if (card.character_book?.token_budget && loreTokens > card.character_book.token_budget) issues.push({ severity: "warning", title: "loreBudgetExceeded", detail: `~${loreTokens} / ${card.character_book.token_budget}`, page: "lorebook", path: "character_book.token_budget" });
  (card.extensions?.regex_scripts ?? []).forEach((script, index) => { if (script.findRegex && !validRegex(script.findRegex)) issues.push({ severity: "error", title: "invalidRegexKey", detail: script.scriptName || `${t("regexScripts")} ${index + 1}`, page: "extensions", path: `extensions.regex_scripts.${index}.findRegex` }); });
  (card.assets ?? []).forEach((asset, index) => { (["type", "uri", "name", "ext"] as const).forEach((field) => { if (!asset[field].trim()) issues.push({ severity: "error", title: "assetFieldEmpty", detail: `${t("asset")} ${index + 1} · ${field}`, page: "assets", path: `assets.${index}.${field}` }); }); });
  return issues;
}

export function OverviewPage({ selected, conflict, dirty, context, onContext, onNavigate, onChangeResource, onRetryConflict, onUseServerDraft, t }: {
  selected: SelectedCharacter;
  conflict: CharacterDraft | null;
  dirty: boolean;
  context: EditorContext;
  onContext: (context: EditorContext) => void;
  onNavigate: (page: ReviewPage) => void;
  onChangeResource: () => void;
  onRetryConflict: () => void;
  onUseServerDraft: () => void;
  t: (key: MessageKey) => string;
}) {
  const [discardOpen, setDiscardOpen] = useState(false);
  const [preview, setPreview] = useState<JsonValue | null>(null);
  const [versions, setVersions] = useState<ResourceVersionSummary[]>([]);
  const [releaseVersion, setReleaseVersion] = useState("");
  const [releaseStatus, setReleaseStatus] = useState<"idle" | "previewing" | "exporting" | "publishing" | "error">("idle");
  const [releaseError, setReleaseError] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  useEffect(() => { let active = true; void listResourceVersions(selected.resource.id).then((items) => { if (active) setVersions(items); }).catch(() => undefined); return () => { active = false; }; }, [selected.resource.id]);
  if (!selected.draft) return <section className="overview-page"><header className="overview-heading"><div><h1>{t("overviewTitle")}</h1><p>{t("noDraftOverview")}</p></div><button className="secondary" onClick={onChangeResource}>{t("changeResource")}</button></header></section>;
  const stats = cardStatistics(selected.draft.data);
  const filled = stats.fieldRows.filter((field) => field.filled).length;
  const completion = Math.round(filled / stats.fieldRows.length * 100);
  const issues = reviewCard(selected.draft.data, t);
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.length - errors;
  const draftLinks = selected.resource.linkedLorebooks.filter((link) => !link.versionId).length;
  const loadPreview = async () => { setReleaseStatus("previewing"); setReleaseError(""); try { setPreview(await previewResourceDraft(selected.resource.id)); setReleaseStatus("idle"); } catch (error) { setReleaseError(String(error)); setReleaseStatus("error"); } };
  const exportDraft = async () => { setReleaseStatus("exporting"); setReleaseError(""); try { const artifact = await exportResourceDraft(selected.resource.id); const binary = atob(artifact.data); const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0)); const url = URL.createObjectURL(new Blob([bytes], { type: artifact.mediaType })); const link = document.createElement("a"); link.href = url; link.download = artifact.fileName; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setReleaseStatus("idle"); } catch (error) { setReleaseError(String(error)); setReleaseStatus("error"); } };
  const publish = async () => { setReleaseStatus("publishing"); setReleaseError(""); try { const version = await publishResource(selected.resource.id, releaseVersion); setVersions((current) => [version, ...current]); setReleaseVersion(""); setPublishOpen(false); setReleaseStatus("idle"); } catch (error) { setReleaseError(String(error)); setReleaseStatus("error"); } };
  const previewCard = preview && typeof preview === "object" && !Array.isArray(preview) ? ((preview as Record<string, JsonValue>).data ?? preview) as Record<string, JsonValue> : null;
  const openIssue = (issue: ReviewIssue) => { onContext({ path: issue.path, selectedText: null, cursor: null }); onNavigate(issue.page); };
  return <section className="overview-page">
    <header className="overview-heading"><div><p className="overview-eyebrow">{selected.resource.metadata.name}</p><h1>{t("overviewTitle")}</h1><p>{t("overviewIntro")}</p></div><button className="secondary" onClick={onChangeResource}>{t("changeResource")}</button></header>
    <div className="metric-grid">
      <article><span>{t("completion")}</span><strong>{completion}%</strong><div className="completion-track"><i style={{ width: `${completion}%` }} /></div></article>
      <article><span>{t("fieldsFilled")}</span><strong>{filled}/{stats.fieldRows.length}</strong></article>
      <article><span>{t("approximateTokens")}</span><strong>{stats.totalTokens.toLocaleString()}</strong></article>
      <article><span>{t("loreEntries")}</span><strong>{stats.entries.length}</strong></article>
    </div>
    <p className="estimate-note">{t("estimateDisclaimer")}</p>
    {conflict && <section className="conflict-panel" role="alert"><div><h2>{t("draftConflict")}</h2><p>{t("draftConflictDetail")}</p><small>{t("localRevision")}: {selected.draft.revision} · {t("serverRevision")}: {conflict.revision}</small></div><div><button className="secondary" onClick={() => setDiscardOpen(true)}>{t("useServerDraft")}</button><button className="primary" onClick={onRetryConflict}>{t("retryLocalDraft")}</button></div></section>}
    <section className="review-panel"><header><div><h2>{t("reviewDiagnostics")}</h2><p>{t("reviewDiagnosticsHint")}</p></div><div className="review-counts"><span className={errors ? "has-errors" : ""}>{errors} {t("errors")}</span><span className={warnings ? "has-warnings" : ""}>{warnings} {t("warnings")}</span></div></header>{issues.length ? <div className="review-issues">{issues.map((issue, index) => <button key={`${issue.path}-${issue.title}-${index}`} onClick={() => openIssue(issue)}><span className={`review-severity ${issue.severity}`} aria-hidden="true">{issue.severity === "error" ? "!" : "△"}</span><span><strong>{t(issue.title)}</strong><small>{issue.detail}</small></span><em>{t("openEditor")}</em></button>)}</div> : <div className="review-ready"><strong>{t("noReviewProblems")}</strong><p>{t("noReviewProblemsDetail")}</p></div>}<footer>{t("deterministicReviewNote")}</footer></section>
    <section className="review-panel release-panel"><header><div><h2>{t("releaseAndExport")}</h2><p>{t("releaseAndExportHint")}</p></div><div className="release-actions"><button className="secondary" disabled={dirty || releaseStatus !== "idle"} onClick={() => void loadPreview()}>{releaseStatus === "previewing" ? t("previewing") : t("previewMerged")}</button><button className="secondary" disabled={dirty || releaseStatus !== "idle"} onClick={() => void exportDraft()}>{releaseStatus === "exporting" ? t("exporting") : t("exportDraft")}</button><button className="primary" disabled={dirty || errors > 0 || draftLinks > 0 || releaseStatus !== "idle"} onClick={() => setPublishOpen(true)}>{t("publishRelease")}</button></div></header>{dirty && <p className="release-blocker" role="alert">{t("unsavedReleaseBlock")}</p>}{draftLinks > 0 && <p className="release-blocker" role="alert">{t("draftLinksBlockPublish")}</p>}{releaseError && <p className="release-blocker" role="alert">{releaseError}</p>}<div className="collection-list"><div><dt>{t("publishedReleases")}</dt><dd>{versions.length}</dd></div>{versions[0] && <div><dt>{t("latestRelease")}</dt><dd>{versions[0].version}</dd></div>}</div></section>
    <div className="overview-columns">
      <section className="overview-panel"><h2>{t("fieldStatus")}</h2><div className="field-status-list">{stats.fieldRows.map((field) => {
        const active = context.path === field.key;
        return <button key={field.key} className={active ? "active" : ""} onClick={() => onContext({ path: field.key, selectedText: field.value || null, cursor: null })} aria-label={`${t("selectForAssistant")}: ${t(field.label)}`}>
          <span className={`status-dot ${field.filled ? "filled" : ""}`} /><span className="field-name">{t(field.label)}</span><span className="field-state">{field.filled ? t("filled") : t("empty")}</span><span className="field-tokens">~{field.tokens}</span>
        </button>;
      })}</div></section>
      <div className="overview-stack">
        <section className="overview-panel"><h2>{t("collectionStats")}</h2><dl className="collection-list"><div><dt>{t("alternateGreetings")}</dt><dd>{stats.alternateCount}</dd></div><div><dt>{t("regexScripts")}</dt><dd>{stats.regexCount}</dd></div><div><dt>{t("characterScripts")}</dt><dd>{stats.scriptCount}</dd></div></dl></section>
        <section className="overview-panel"><h2>{t("loreTypes")}</h2>{stats.typeCounts.size ? <div className="type-list">{[...stats.typeCounts].sort(([a], [b]) => a.localeCompare(b)).map(([type, count]) => <span key={type}>{type}<strong>{count}</strong></span>)}</div> : <p className="muted">—</p>}</section>
      </div>
    </div>
    {discardOpen && <div className="confirmation-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) setDiscardOpen(false); }}><section className="confirmation-dialog" role="alertdialog" aria-modal="true"><h2>{t("useServerDraftTitle")}</h2><p>{t("useServerDraftBody")}</p><div><button className="secondary" autoFocus onClick={() => setDiscardOpen(false)}>{t("cancel")}</button><button className="danger-button" onClick={() => { setDiscardOpen(false); onUseServerDraft(); }}>{t("useServerDraft")}</button></div></section></div>}
    {previewCard && <div className="confirmation-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null); }}><section className="confirmation-dialog release-preview" role="dialog" aria-modal="true"><h2>{String(previewCard.name ?? t("mergedPreview"))}</h2><p>{t("mergedPreviewHint")}</p>{["description", "personality", "scenario", "first_mes", "mes_example", "creator_notes", "system_prompt", "post_history_instructions"].map((field) => typeof previewCard[field] === "string" && previewCard[field] ? <article key={field}><strong>{field.replace(/_/g, " ")}</strong><p>{String(previewCard[field])}</p></article> : null)}<div><button className="primary" onClick={() => setPreview(null)}>{t("close")}</button></div></section></div>}
    {publishOpen && <div className="confirmation-layer"><section className="confirmation-dialog" role="dialog" aria-modal="true"><h2>{t("publishRelease")}</h2><p>{t("publishReleaseHint")}</p><label>{t("releaseVersionLabel")}<input autoFocus value={releaseVersion} onChange={(event) => setReleaseVersion(event.target.value)} /></label><div><button className="secondary" onClick={() => setPublishOpen(false)}>{t("cancel")}</button><button className="primary" disabled={!releaseVersion.trim() || releaseStatus === "publishing"} onClick={() => void publish()}>{releaseStatus === "publishing" ? t("publishing") : t("publishRelease")}</button></div></section></div>}
  </section>;
}
