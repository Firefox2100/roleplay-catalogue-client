import type { MessageKey } from "./i18n";
import { estimateTokens } from "./OverviewPage";
import type { CharacterCardV3Data, EditorContext, SelectedCharacter, WorldOverview } from "./types";
import "./RuntimeInstructionsPage.css";

type RuntimeField = "system_prompt" | "post_history_instructions";

export function RuntimeInstructionsPage({ selected, castMode, context, dirty, status, onChange, onContext, onDraft, onSave, t }: {
  selected: SelectedCharacter;
  castMode: WorldOverview["castMode"];
  context: EditorContext;
  dirty: boolean;
  status: "idle" | "saving" | "saved" | "error";
  onChange: (data: CharacterCardV3Data) => void;
  onContext: (context: EditorContext) => void;
  onDraft: () => void;
  onSave: () => void;
  t: (key: MessageKey) => string;
}) {
  if (!selected.draft) return <section className="runtime-page"><p className="loading-text">{t("noDraftOverview")}</p></section>;
  const card = selected.draft.data;
  const value = (field: RuntimeField) => typeof card[field] === "string" ? card[field] : "";
  const systemTokens = estimateTokens(value("system_prompt"));
  const historyTokens = estimateTokens(value("post_history_instructions"));
  const update = (field: RuntimeField, next: string, cursor: number | null) => {
    onChange({ ...card, [field]: next });
    onContext({ path: field, selectedText: next || null, cursor });
  };
  const select = (field: RuntimeField, element: HTMLTextAreaElement) => {
    const selectedText = element.value.slice(element.selectionStart ?? 0, element.selectionEnd ?? 0);
    onContext({ path: field, selectedText: selectedText || element.value || null, cursor: element.selectionStart });
  };
  const guide = castMode === "fixed-ensemble" ? "runtimeFixedGuide" : castMode === "dynamic-ensemble" ? "runtimeDynamicGuide" : "runtimeSingleGuide";
  const field = (path: RuntimeField, title: MessageKey, role: MessageKey, hint: MessageKey, rows: number) => <section className={`runtime-editor ${context.path === path ? "active" : ""}`}><header><div><h2>{t(title)}</h2><p>{t(role)}</p></div><strong>~{estimateTokens(value(path))} {t("approximateFieldTokens")}</strong></header><p className="runtime-field-hint">{t(hint)}</p><textarea rows={rows} value={value(path)} onFocus={(event) => select(path, event.currentTarget)} onSelect={(event) => select(path, event.currentTarget)} onChange={(event) => update(path, event.target.value, event.target.selectionStart)} spellCheck /></section>;
  return <section className="runtime-page">
    <header className="runtime-heading"><div><p className="runtime-eyebrow">{selected.resource.metadata.name}</p><h1>{t("runtimeTitle")}</h1><p>{t("runtimeIntro")}</p></div><button className="secondary" onClick={onDraft}>{t("draftRuntime")}</button></header>
    <aside className="runtime-guide"><strong>{t(castMode === "fixed-ensemble" ? "fixedEnsemble" : castMode === "dynamic-ensemble" ? "dynamicEnsemble" : "fixedSingle")}</strong><p>{t(guide)}</p></aside>
    <section className="runtime-summary" aria-label={t("runtimeTokenCost")}><article><strong>~{systemTokens}</strong><span>{t("systemTokens")}</span></article><article><strong>~{historyTokens}</strong><span>{t("postHistoryTokens")}</span></article><article><strong>~{systemTokens + historyTokens}</strong><span>{t("combinedRuntimeTokens")}</span></article></section>
    <section className="runtime-principles"><h2>{t("runtimePrinciples")}</h2><ul><li>{t("runtimePrincipleSpecific")}</li><li>{t("runtimePrincipleNoDuplication")}</li><li>{t("runtimePrincipleAgency")}</li></ul></section>
    {field("system_prompt", "systemPromptField", "systemPromptRole", "systemPromptHint", 14)}
    {field("post_history_instructions", "postHistoryField", "postHistoryRole", "postHistoryHint", 10)}
    <div className="runtime-save-bar"><span role="status">{status === "saved" ? t("runtimeSaved") : status === "error" ? t("runtimeSaveError") : dirty ? t("unsavedChanges") : ""}</span><button className="primary" onClick={onSave} disabled={!dirty || status === "saving"}>{status === "saving" ? t("saving") : t("saveRuntime")}</button></div>
  </section>;
}
