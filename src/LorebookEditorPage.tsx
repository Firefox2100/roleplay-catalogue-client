import { useEffect, useMemo, useState } from "react";
import type { MessageKey } from "./i18n";
import { estimateTokens } from "./OverviewPage";
import type { LorebookData, LorebookEntry } from "./types";
import "./LorebookEditorPage.css";

const blankBook = (name: string): LorebookData => ({ name, description: "", scan_depth: null, token_budget: null, recursive_scanning: false, extensions: {}, entries: [] });
const blankEntry = (order: number): LorebookEntry => ({ name: "", comment: "", keys: [], secondary_keys: [], content: "", extensions: {}, enabled: true, insertion_order: order, use_regex: false, constant: false, selective: false, case_sensitive: null, priority: null, position: null });
const newKey = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const listText = (values: string[] | null | undefined) => (values ?? []).join(", ");
const parseList = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

export function LorebookEditorPage({ value, fallbackName, embedded, dirty, status, onChange, onSave, t }: {
  value: LorebookData | null;
  fallbackName: string;
  embedded: boolean;
  dirty: boolean;
  status: "idle" | "saving" | "saved" | "error";
  onChange: (value: LorebookData) => void;
  onSave: () => void;
  t: (key: MessageKey) => string;
}) {
  const [entryKeys, setEntryKeys] = useState<string[]>(() => (value?.entries ?? []).map(() => newKey()));
  const [selectedKey, setSelectedKey] = useState<string | null>(() => entryKeys[0] ?? null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  useEffect(() => {
    const length = value?.entries.length ?? 0;
    setEntryKeys((keys) => length === keys.length ? keys : [...keys.slice(0, length), ...Array.from({ length: Math.max(0, length - keys.length) }, newKey)]);
  }, [value?.entries.length]);
  const selectedIndex = selectedKey ? entryKeys.indexOf(selectedKey) : -1;
  const selected = selectedIndex >= 0 ? value?.entries[selectedIndex] ?? null : null;
  const totalTokens = useMemo(() => (value?.entries ?? []).reduce((sum, entry) => sum + estimateTokens(entry.content), 0), [value]);
  if (!value) return <section className="lorebook-page lorebook-empty"><div><h1>{t(embedded ? "embeddedLorebook" : "lorebookEditor")}</h1><p>{t(embedded ? "noEmbeddedLorebook" : "noLorebookDraft")}</p><button className="primary" onClick={() => onChange(blankBook(fallbackName))}>{t("createLorebookDraft")}</button></div></section>;
  const updateBook = <K extends keyof LorebookData>(key: K, next: LorebookData[K]) => onChange({ ...value, [key]: next });
  const updateEntry = <K extends keyof LorebookEntry>(key: K, next: LorebookEntry[K]) => {
    if (selectedIndex < 0) return;
    const entries = [...value.entries];
    entries[selectedIndex] = { ...entries[selectedIndex], [key]: next };
    onChange({ ...value, entries });
  };
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
    <header className="lorebook-heading"><div><p className="lorebook-eyebrow">{embedded ? t("embeddedInCharacter") : t("standaloneLorebook")}</p><h1>{t("lorebookEditor")}</h1><p>{t("lorebookIntro")}</p></div><div className="lorebook-heading-stats"><strong>{value.entries.length}</strong><span>{t("loreEntries")}</span><strong>~{totalTokens}</strong><span>{t("approximateTokens")}</span></div></header>
    <section className="lorebook-settings"><h2>{t("lorebookSettings")}</h2><div className="lorebook-settings-grid"><label>{t("lorebookName")}<input value={value.name ?? ""} onChange={(event) => updateBook("name", event.target.value)} /></label><label>{t("scanDepth")}<input type="number" min="0" value={value.scan_depth ?? ""} onChange={(event) => updateBook("scan_depth", event.target.value === "" ? null : Number(event.target.value))} /></label><label>{t("tokenBudget")}<input type="number" min="0" value={value.token_budget ?? ""} onChange={(event) => updateBook("token_budget", event.target.value === "" ? null : Number(event.target.value))} /></label><label className="lorebook-check"><input type="checkbox" checked={value.recursive_scanning ?? false} onChange={(event) => updateBook("recursive_scanning", event.target.checked)} />{t("recursiveScanning")}</label></div><label className="lorebook-description">{t("description")}<textarea rows={3} value={value.description ?? ""} onChange={(event) => updateBook("description", event.target.value)} /></label></section>
    <div className="lorebook-workspace"><aside className="lorebook-entry-list"><header><div><h2>{t("entries")}</h2><span>{value.entries.length}</span></div><button className="primary" onClick={addEntry}>{t("addEntry")}</button></header>{value.entries.length === 0 ? <p>{t("noLoreEntries")}</p> : <div>{value.entries.map((entry, index) => <button key={entryKeys[index]} className={selectedKey === entryKeys[index] ? "active" : ""} onClick={() => setSelectedKey(entryKeys[index])}><strong>{entry.name?.trim() || entry.comment?.trim() || `${t("entry")} ${index + 1}`}</strong><small>{entry.constant ? t("constantEntry") : entry.keys.length ? entry.keys.join(", ") : t("noKeys")}</small><span>{entry.enabled ? t("enabled") : t("disabled")}</span></button>)}</div>}</aside>
      <section className="lorebook-entry-editor">{selected ? <><header><div><h2>{selected.name?.trim() || `${t("entry")} ${selectedIndex + 1}`}</h2><p>{t("entryEditorHint")}</p></div><div><button className="secondary" onClick={() => move(-1)} disabled={selectedIndex === 0}>{t("moveUp")}</button><button className="secondary" onClick={() => move(1)} disabled={selectedIndex === value.entries.length - 1}>{t("moveDown")}</button><button className="danger-outline" onClick={() => setPendingDelete(selectedKey)}>{t("deleteEntry")}</button></div></header>
        <div className="entry-toggle-row"><label><input type="checkbox" checked={selected.enabled} onChange={(event) => updateEntry("enabled", event.target.checked)} />{t("enabled")}</label><label><input type="checkbox" checked={selected.constant} onChange={(event) => updateEntry("constant", event.target.checked)} />{t("constantEntry")}</label><label><input type="checkbox" checked={selected.use_regex} onChange={(event) => updateEntry("use_regex", event.target.checked)} />{t("regexKeys")}</label><label><input type="checkbox" checked={selected.selective ?? false} onChange={(event) => updateEntry("selective", event.target.checked)} />{t("selectiveEntry")}</label></div>
        <div className="entry-form-grid"><label>{t("entryName")}<input value={selected.name ?? ""} onChange={(event) => updateEntry("name", event.target.value)} /></label><label>{t("entryComment")}<input value={selected.comment ?? ""} onChange={(event) => updateEntry("comment", event.target.value)} /></label><label className="entry-wide">{t("primaryKeys")}<input value={listText(selected.keys)} onChange={(event) => updateEntry("keys", parseList(event.target.value))} /><small>{t("keysHint")}</small></label><label className="entry-wide">{t("secondaryKeys")}<input value={listText(selected.secondary_keys)} onChange={(event) => updateEntry("secondary_keys", parseList(event.target.value))} /></label><label>{t("insertionOrder")}<input type="number" value={selected.insertion_order} onChange={(event) => updateEntry("insertion_order", Number(event.target.value))} /></label><label>{t("priority")}<input type="number" value={selected.priority ?? ""} onChange={(event) => updateEntry("priority", event.target.value === "" ? null : Number(event.target.value))} /></label><label>{t("position")}<select value={selected.position ?? ""} onChange={(event) => updateEntry("position", event.target.value ? event.target.value as LorebookEntry["position"] : null)}><option value="">{t("defaultPosition")}</option><option value="before_char">{t("beforeCharacter")}</option><option value="after_char">{t("afterCharacter")}</option></select></label><label>{t("caseSensitivity")}<select value={selected.case_sensitive == null ? "" : String(selected.case_sensitive)} onChange={(event) => updateEntry("case_sensitive", event.target.value === "" ? null : event.target.value === "true")}><option value="">{t("defaultSetting")}</option><option value="true">{t("caseSensitive")}</option><option value="false">{t("caseInsensitive")}</option></select></label><label className="entry-wide">{t("entryContent")}<textarea rows={14} value={selected.content} onChange={(event) => updateEntry("content", event.target.value)} /><small>~{estimateTokens(selected.content)} {t("approximateFieldTokens")}</small></label></div>
      </> : <div className="entry-unselected"><p>{t("selectLoreEntry")}</p><button className="primary" onClick={addEntry}>{t("addEntry")}</button></div>}</section>
    </div>
    <div className="lorebook-save-bar"><span role="status">{status === "saved" ? t("lorebookSaved") : status === "error" ? t("lorebookSaveError") : dirty ? t("unsavedChanges") : ""}</span><button className="primary" onClick={onSave} disabled={!dirty || status === "saving"}>{status === "saving" ? t("saving") : t("saveLorebook")}</button></div>
    {pendingDelete && <div className="confirmation-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingDelete(null); }}><section className="confirmation-dialog" role="alertdialog" aria-modal="true"><h2>{t("deleteEntryTitle")}</h2><p>{t("deleteEntryBody")}</p><div><button className="secondary" autoFocus onClick={() => setPendingDelete(null)}>{t("cancel")}</button><button className="danger-button" onClick={remove}>{t("deleteEntry")}</button></div></section></div>}
  </section>;
}
