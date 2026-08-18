import type { MessageKey } from "./i18n";
import { estimateTokens } from "./OverviewPage";
import type { CharacterCardV3Data, EditorContext, SelectedCharacter, WorldOverview } from "./types";
import "./CharacterFoundationPage.css";

type FoundationField = "name" | "nickname" | "description" | "personality";

const textValue = (card: CharacterCardV3Data, field: FoundationField) => {
  const value = card[field];
  return typeof value === "string" ? value : "";
};

export function CharacterFoundationPage({ selected, castMode, context, dirty, status, onChange, onContext, onDraft, onSave, t }: {
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
  if (!selected.draft) return <section className="foundation-page"><p className="loading-text">{t("noDraftOverview")}</p></section>;
  const card = selected.draft.data;
  const guide = castMode === "fixed-ensemble" ? "foundationFixedGuide" : castMode === "dynamic-ensemble" ? "foundationDynamicGuide" : "foundationSingleGuide";
  const update = (field: FoundationField, value: string, cursor: number | null) => {
    onChange({ ...card, [field]: value });
    onContext({ path: field, selectedText: value || null, cursor });
  };
  const contextFor = (field: FoundationField, element: HTMLInputElement | HTMLTextAreaElement) => {
    const selectedText = element.value.slice(element.selectionStart ?? 0, element.selectionEnd ?? 0) || element.value || null;
    onContext({ path: field, selectedText, cursor: element.selectionStart });
  };
  const fieldClass = (field: FoundationField) => `foundation-field ${context.path === field ? "active" : ""}`;
  return <section className="foundation-page">
    <header className="foundation-heading"><div><p className="foundation-eyebrow">{selected.resource.metadata.name}</p><h1>{t("foundationTitle")}</h1><p>{t("foundationIntro")}</p></div><button className="secondary" onClick={onDraft}>{t("draftFoundation")}</button></header>
    <aside className="foundation-guide"><strong>{t(castMode === "fixed-ensemble" ? "fixedEnsemble" : castMode === "dynamic-ensemble" ? "dynamicEnsemble" : "fixedSingle")}</strong><p>{t(guide)}</p></aside>
    <div className="foundation-identity-grid">
      <label className={fieldClass("name")}><span><strong>{t("cardName")}</strong><small>{t("cardNameHint")}</small></span><input value={textValue(card, "name")} onFocus={(event) => contextFor("name", event.currentTarget)} onSelect={(event) => contextFor("name", event.currentTarget)} onChange={(event) => update("name", event.target.value, event.target.selectionStart)} /><em>~{estimateTokens(textValue(card, "name"))} {t("approximateFieldTokens")}</em></label>
      <label className={fieldClass("nickname")}><span><strong>{t("nickname")}</strong><small>{t("nicknameHint")}</small></span><input value={textValue(card, "nickname")} onFocus={(event) => contextFor("nickname", event.currentTarget)} onSelect={(event) => contextFor("nickname", event.currentTarget)} onChange={(event) => update("nickname", event.target.value, event.target.selectionStart)} /><em>~{estimateTokens(textValue(card, "nickname"))} {t("approximateFieldTokens")}</em></label>
    </div>
    <label className={fieldClass("description")}><span><strong>{t("characterDescription")}</strong><small>{t("characterDescriptionHint")}</small></span><textarea rows={14} value={textValue(card, "description")} onFocus={(event) => contextFor("description", event.currentTarget)} onSelect={(event) => contextFor("description", event.currentTarget)} onChange={(event) => update("description", event.target.value, event.target.selectionStart)} /><em>~{estimateTokens(textValue(card, "description"))} {t("approximateFieldTokens")}</em></label>
    <label className={fieldClass("personality")}><span><strong>{t("personalitySummary")}</strong><small>{t("personalitySummaryHint")}</small></span><textarea rows={7} value={textValue(card, "personality")} onFocus={(event) => contextFor("personality", event.currentTarget)} onSelect={(event) => contextFor("personality", event.currentTarget)} onChange={(event) => update("personality", event.target.value, event.target.selectionStart)} /><em>~{estimateTokens(textValue(card, "personality"))} {t("approximateFieldTokens")}</em></label>
    <div className="foundation-save-bar"><span role="status">{status === "saved" ? t("foundationSaved") : status === "error" ? t("foundationSaveError") : dirty ? t("unsavedChanges") : ""}</span><button className="primary" onClick={onSave} disabled={!dirty || status === "saving"}>{status === "saving" ? t("saving") : t("saveFoundation")}</button></div>
  </section>;
}
