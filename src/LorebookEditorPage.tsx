import { useEffect, useMemo, useState } from "react";
import type { MessageKey } from "./i18n";
import { estimateTokens } from "./OverviewPage";
import type { EditorContext, LorebookData, LorebookDraft, LorebookEntry } from "./types";
import "./LorebookEditorPage.css";

const blankBook = (name: string): LorebookData => ({ name, description: "", scan_depth: null, token_budget: null, recursive_scanning: false, extensions: {}, entries: [] });
const blankEntry = (order: number): LorebookEntry => ({ name: "", comment: "", keys: [], secondary_keys: [], content: "", extensions: {}, enabled: true, insertion_order: order, use_regex: false, constant: false, selective: false, case_sensitive: null, priority: null, position: null });
const newKey = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const listText = (values: string[] | null | undefined) => (values ?? []).join("\n");
const parseList = (value: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);

type LorebookDiagnostic = { level: "error" | "warning"; entry: number; message: MessageKey };
const compileRegex = (pattern: string, caseSensitive: boolean | null | undefined = true) => {
  const literal = pattern.startsWith("/") ? pattern.match(/^\/(.*)\/([a-z]*)$/s) : null;
  const source = literal ? literal[1] : pattern;
  let flags = literal ? literal[2] : "";
  if (!caseSensitive && !flags.includes("i")) flags += "i";
  return new RegExp(source, flags);
};
const regexValid = (pattern: string) => { try { compileRegex(pattern); return true; } catch { return false; } };
const matchesKey = (entry: LorebookEntry, key: string, text: string) => {
  if (entry.use_regex) { try { return compileRegex(key, entry.case_sensitive).test(text); } catch { return false; } }
  return entry.case_sensitive ? text.includes(key) : text.toLocaleLowerCase().includes(key.toLocaleLowerCase());
};
const simulateActivation = (book: LorebookData, initial: string) => {
  const active = new Set<number>();
  let searchable = initial;
  for (let pass = 0; pass < (book.recursive_scanning ? 10 : 1); pass += 1) {
    let changed = false;
    book.entries.forEach((entry, index) => {
      if (!entry.enabled || active.has(index)) return;
      const primary = entry.keys.some((key) => matchesKey(entry, key, searchable));
      const secondary = (entry.secondary_keys ?? []).some((key) => matchesKey(entry, key, searchable));
      if (entry.constant || primary && (!entry.selective || secondary)) { active.add(index); searchable += `\n${entry.content}`; changed = true; }
    });
    if (!changed) break;
  }
  return active;
};

export function LorebookEditorPage({ value, fallbackName, embedded, dirty, status, conflict = null, localRevision = 0, onUseServerDraft, onRetryConflict, onChange, onContext, onDraft, onSave, t }: {
  value: LorebookData | null;
  fallbackName: string;
  embedded: boolean;
  dirty: boolean;
  status: "idle" | "saving" | "saved" | "error";
  conflict?: LorebookDraft | null;
  localRevision?: number;
  onUseServerDraft?: () => void;
  onRetryConflict?: () => void;
  onChange: (value: LorebookData) => void;
  onContext: (context: EditorContext) => void;
  onDraft: () => void;
  onSave: () => void;
  t: (key: MessageKey) => string;
}) {
  const [entryKeys, setEntryKeys] = useState<string[]>(() => (value?.entries ?? []).map(() => newKey()));
  const [selectedKey, setSelectedKey] = useState<string | null>(() => entryKeys[0] ?? null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [discardConflictOpen, setDiscardConflictOpen] = useState(false);
  const [testText, setTestText] = useState("");
  useEffect(() => {
    const length = value?.entries.length ?? 0;
    setEntryKeys((keys) => length === keys.length ? keys : [...keys.slice(0, length), ...Array.from({ length: Math.max(0, length - keys.length) }, newKey)]);
  }, [value?.entries.length]);
  const selectedIndex = selectedKey ? entryKeys.indexOf(selectedKey) : -1;
  const selected = selectedIndex >= 0 ? value?.entries[selectedIndex] ?? null : null;
  const totalTokens = useMemo(() => (value?.entries ?? []).reduce((sum, entry) => sum + estimateTokens(entry.content), 0), [value]);
  const activeEntries = useMemo(() => value ? simulateActivation(value, testText) : new Set<number>(), [value, testText]);
  const diagnostics = useMemo(() => (value?.entries ?? []).flatMap<LorebookDiagnostic>((entry, index) => {
    const issues: LorebookDiagnostic[] = [];
    if (entry.enabled && !entry.content.trim()) issues.push({ level: "error", entry: index, message: "emptyLoreContent" });
    if (entry.enabled && !entry.constant && entry.keys.length === 0) issues.push({ level: "warning", entry: index, message: "missingActivationKeys" });
    if (entry.selective && !(entry.secondary_keys ?? []).length) issues.push({ level: "error", entry: index, message: "missingSecondaryKeys" });
    if (entry.use_regex && entry.keys.some((key) => !regexValid(key)) || entry.use_regex && (entry.secondary_keys ?? []).some((key) => !regexValid(key))) issues.push({ level: "error", entry: index, message: "invalidRegexKey" });
    return issues;
  }), [value]);
  if (!value) return <section className="lorebook-page lorebook-empty"><div><h1>{t(embedded ? "embeddedLorebook" : "lorebookEditor")}</h1><p>{t(embedded ? "noEmbeddedLorebook" : "noLorebookDraft")}</p><button className="primary" onClick={() => onChange(blankBook(fallbackName))}>{t("createLorebookDraft")}</button></div></section>;
  const updateBook = <K extends keyof LorebookData>(key: K, next: LorebookData[K]) => onChange({ ...value, [key]: next });
  const updateEntry = <K extends keyof LorebookEntry>(key: K, next: LorebookEntry[K]) => {
    if (selectedIndex < 0) return;
    const entries = [...value.entries];
    entries[selectedIndex] = { ...entries[selectedIndex], [key]: next };
    onChange({ ...value, entries });
  };
  const contextFor = (field: string, text: string | null = null) => onContext({ path: `${embedded ? "character_book" : "lorebook"}.${field}`, selectedText: text, cursor: null });
  const addEntry = () => {
    const key = newKey();
    const nextOrder = value.entries.reduce((maximum, entry) => Math.max(maximum, entry.insertion_order), -1) + 1;
    setEntryKeys((keys) => [...keys, key]);
    setSelectedKey(key);
    onChange({ ...value, entries: [...value.entries, blankEntry(nextOrder)] });
  };
  const move = (direction: -1 | 1) => {
    const target = selectedIndex + direction;
    if (selectedIndex < 0 || target < 0 || target >= value.entries.length) return;
    const entries = [...value.entries], keys = [...entryKeys];
    [entries[selectedIndex], entries[target]] = [entries[target], entries[selectedIndex]];
    [keys[selectedIndex], keys[target]] = [keys[target], keys[selectedIndex]];
    setEntryKeys(keys);
    onChange({ ...value, entries });
  };
  const remove = () => {
    if (!pendingDelete) return;
    const index = entryKeys.indexOf(pendingDelete);
    if (index < 0) return;
    const keys = entryKeys.filter((key) => key !== pendingDelete);
    setEntryKeys(keys);
    setSelectedKey(keys[Math.min(index, keys.length - 1)] ?? null);
    setPendingDelete(null);
    onChange({ ...value, entries: value.entries.filter((_, entryIndex) => entryIndex !== index) });
  };
  return <section className="lorebook-page">
    <header className="lorebook-heading"><div><p className="lorebook-eyebrow">{embedded ? t("embeddedInCharacter") : t("standaloneLorebook")}</p><h1>{t("lorebookEditor")}</h1><p>{t("lorebookIntro")}</p></div><div className="lorebook-heading-actions"><button className="secondary" onClick={onDraft}>{t("draftLoreEntry")}</button><div className="lorebook-heading-stats"><strong>{value.entries.length}</strong><span>{t("loreEntries")}</span><strong>~{totalTokens}</strong><span>{t("approximateTokens")}</span></div></div></header>
    {conflict && <section className="lorebook-conflict" role="alert"><div><h2>{t("draftConflict")}</h2><p>{t("draftConflictDetail")}</p><small>{t("localRevision")}: {localRevision} · {t("serverRevision")}: {conflict.revision}</small></div><div><button className="secondary" onClick={() => setDiscardConflictOpen(true)}>{t("useServerDraft")}</button><button className="primary" onClick={onRetryConflict}>{t("retryLocalDraft")}</button></div></section>}
    <section className="lorebook-settings"><h2>{t("lorebookSettings")}</h2><div className="lorebook-settings-grid"><label>{t("lorebookName")}<input value={value.name ?? ""} onFocus={() => contextFor("name", value.name ?? null)} onChange={(event) => updateBook("name", event.target.value)} /></label><label>{t("scanDepth")}<input type="number" min="0" value={value.scan_depth ?? ""} onChange={(event) => updateBook("scan_depth", event.target.value === "" ? null : Number(event.target.value))} /></label><label>{t("tokenBudget")}<input type="number" min="0" value={value.token_budget ?? ""} onChange={(event) => updateBook("token_budget", event.target.value === "" ? null : Number(event.target.value))} /></label><label className="lorebook-check"><input type="checkbox" checked={value.recursive_scanning ?? false} onChange={(event) => updateBook("recursive_scanning", event.target.checked)} />{t("recursiveScanning")}</label></div><label className="lorebook-description">{t("description")}<textarea rows={3} value={value.description ?? ""} onFocus={() => contextFor("description", value.description ?? null)} onChange={(event) => updateBook("description", event.target.value)} /></label></section>
    <section className="lorebook-tools"><div className="activation-tester"><h2>{t("activationTester")}</h2><p>{t("activationTesterHint")}</p><textarea rows={4} value={testText} onChange={(event) => setTestText(event.target.value)} placeholder={t("activationTestPlaceholder")} /><div><strong>{t("activatedEntries")}</strong><span>{activeEntries.size ? [...activeEntries].map((index) => value.entries[index].name?.trim() || `${t("entry")} ${index + 1}`).join(", ") : t("noneActivated")}</span></div></div><div className="lorebook-diagnostics"><h2>{t("lorebookDiagnostics")}</h2><p>{diagnostics.length ? t("diagnosticsFound") : t("noLorebookProblems")}</p>{diagnostics.length > 0 && <ul>{diagnostics.map((issue, index) => <li className={issue.level} key={`${issue.entry}-${issue.message}-${index}`}><button onClick={() => setSelectedKey(entryKeys[issue.entry])}>{t("entry")} {issue.entry + 1}: {t(issue.message)}</button></li>)}</ul>}</div></section>
    <div className="lorebook-workspace"><aside className="lorebook-entry-list"><header><div><h2>{t("entries")}</h2><span>{value.entries.length}</span></div><button className="primary" onClick={addEntry}>{t("addEntry")}</button></header>{value.entries.length === 0 ? <p>{t("noLoreEntries")}</p> : <div>{value.entries.map((entry, index) => <button key={entryKeys[index]} className={`${selectedKey === entryKeys[index] ? "active" : ""} ${activeEntries.has(index) ? "activated" : ""}`} onClick={() => { setSelectedKey(entryKeys[index]); contextFor(`entries.${index}.content`, entry.content || null); }}><strong>{entry.name?.trim() || entry.comment?.trim() || `${t("entry")} ${index + 1}`}</strong><small>{entry.constant ? t("constantEntry") : entry.keys.length ? entry.keys.join(", ") : t("noKeys")}</small><span>{activeEntries.has(index) ? t("activated") : entry.enabled ? t("enabled") : t("disabled")}</span></button>)}</div>}</aside>
      <section className="lorebook-entry-editor">{selected ? <><header><div><h2>{selected.name?.trim() || `${t("entry")} ${selectedIndex + 1}`}</h2><p>{t("entryEditorHint")}</p></div><div><button className="secondary" onClick={() => move(-1)} disabled={selectedIndex === 0}>{t("moveUp")}</button><button className="secondary" onClick={() => move(1)} disabled={selectedIndex === value.entries.length - 1}>{t("moveDown")}</button><button className="danger-outline" onClick={() => setPendingDelete(selectedKey)}>{t("deleteEntry")}</button></div></header>
        <div className="entry-toggle-row"><label><input type="checkbox" checked={selected.enabled} onChange={(event) => updateEntry("enabled", event.target.checked)} />{t("enabled")}</label><label><input type="checkbox" checked={selected.constant} onChange={(event) => updateEntry("constant", event.target.checked)} />{t("constantEntry")}</label><label><input type="checkbox" checked={selected.use_regex} onChange={(event) => updateEntry("use_regex", event.target.checked)} />{t("regexKeys")}</label><label><input type="checkbox" checked={selected.selective ?? false} onChange={(event) => updateEntry("selective", event.target.checked)} />{t("selectiveEntry")}</label></div>
        <div className="entry-form-grid">
          <label>{t("entryName")}<input value={selected.name ?? ""} onFocus={() => contextFor(`entries.${selectedIndex}.name`, selected.name ?? null)} onChange={(event) => updateEntry("name", event.target.value)} /></label>
          <label>{t("entryComment")}<input value={selected.comment ?? ""} onFocus={() => contextFor(`entries.${selectedIndex}.comment`, selected.comment ?? null)} onChange={(event) => updateEntry("comment", event.target.value)} /></label>
          <label className="entry-wide">{t("primaryKeys")}<textarea rows={3} value={listText(selected.keys)} onFocus={() => contextFor(`entries.${selectedIndex}.keys`, listText(selected.keys))} onChange={(event) => updateEntry("keys", parseList(event.target.value))} /><small>{t("keysLineHint")}</small></label>
          <label className="entry-wide">{t("secondaryKeys")}<textarea rows={2} value={listText(selected.secondary_keys)} onFocus={() => contextFor(`entries.${selectedIndex}.secondary_keys`, listText(selected.secondary_keys))} onChange={(event) => updateEntry("secondary_keys", parseList(event.target.value))} /></label>
          <label>{t("insertionOrder")}<input type="number" value={selected.insertion_order} onChange={(event) => updateEntry("insertion_order", Number(event.target.value))} /></label>
          <label>{t("priority")}<input type="number" value={selected.priority ?? ""} onChange={(event) => updateEntry("priority", event.target.value === "" ? null : Number(event.target.value))} /></label>
          <label>{t("position")}<select value={selected.position ?? ""} onChange={(event) => updateEntry("position", event.target.value ? event.target.value as LorebookEntry["position"] : null)}><option value="">{t("defaultPosition")}</option><option value="before_char">{t("beforeCharacter")}</option><option value="after_char">{t("afterCharacter")}</option></select></label>
          <label>{t("caseSensitivity")}<select value={selected.case_sensitive == null ? "" : String(selected.case_sensitive)} onChange={(event) => updateEntry("case_sensitive", event.target.value === "" ? null : event.target.value === "true")}><option value="">{t("defaultSetting")}</option><option value="true">{t("caseSensitive")}</option><option value="false">{t("caseInsensitive")}</option></select></label>
          <label className="entry-wide">{t("entryContent")}<textarea rows={14} value={selected.content} onFocus={() => contextFor(`entries.${selectedIndex}.content`, selected.content)} onChange={(event) => updateEntry("content", event.target.value)} /><small>~{estimateTokens(selected.content)} {t("approximateFieldTokens")}</small></label>
        </div>
      </> : <div className="entry-unselected"><p>{t("selectLoreEntry")}</p><button className="primary" onClick={addEntry}>{t("addEntry")}</button></div>}</section>
    </div>
    <div className="lorebook-save-bar"><span role="status">{status === "saved" ? t("lorebookSaved") : status === "error" ? t("lorebookSaveError") : dirty ? t("unsavedChanges") : ""}</span><button className="primary" onClick={onSave} disabled={!dirty || status === "saving"}>{status === "saving" ? t("saving") : t("saveLorebook")}</button></div>
    {pendingDelete && <div className="confirmation-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingDelete(null); }}><section className="confirmation-dialog" role="alertdialog" aria-modal="true"><h2>{t("deleteEntryTitle")}</h2><p>{t("deleteEntryBody")}</p><div><button className="secondary" autoFocus onClick={() => setPendingDelete(null)}>{t("cancel")}</button><button className="danger-button" onClick={remove}>{t("deleteEntry")}</button></div></section></div>}
    {discardConflictOpen && <div className="confirmation-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) setDiscardConflictOpen(false); }}><section className="confirmation-dialog" role="alertdialog" aria-modal="true"><h2>{t("useServerDraftTitle")}</h2><p>{t("useServerDraftBody")}</p><div><button className="secondary" autoFocus onClick={() => setDiscardConflictOpen(false)}>{t("cancel")}</button><button className="danger-button" onClick={() => { setDiscardConflictOpen(false); onUseServerDraft?.(); }}>{t("useServerDraft")}</button></div></section></div>}
  </section>;
}
