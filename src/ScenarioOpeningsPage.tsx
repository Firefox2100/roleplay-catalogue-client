import type { MessageKey } from "./i18n";
import { estimateTokens } from "./OverviewPage";
import type { CharacterCardV3Data, EditorContext, SelectedCharacter, WorldOverview } from "./types";
import "./ScenarioOpeningsPage.css";

type TextField = "scenario" | "first_mes";
type CollectionField = "alternate_greetings" | "group_only_greetings";

const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export function ScenarioOpeningsPage({ selected, castMode, context, dirty, status, onChange, onContext, onDraft, onSave, t }: {
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
  if (!selected.draft) return <section className="scenes-page"><p className="loading-text">{t("noDraftOverview")}</p></section>;
  const card = selected.draft.data;
  const updateText = (field: TextField, value: string, cursor: number | null) => {
    onChange({ ...card, [field]: value });
    onContext({ path: field, selectedText: value || null, cursor });
  };
  const focusText = (path: string, element: HTMLTextAreaElement) => {
    const selection = element.value.slice(element.selectionStart ?? 0, element.selectionEnd ?? 0);
    onContext({ path, selectedText: selection || element.value || null, cursor: element.selectionStart });
  };
  const updateCollection = (field: CollectionField, values: string[], activeIndex?: number) => {
    onChange({ ...card, [field]: values });
    onContext({ path: activeIndex === undefined ? field : `${field}.${activeIndex}`, selectedText: activeIndex === undefined ? null : values[activeIndex] || null, cursor: null });
  };
  const collection = (field: CollectionField, title: MessageKey, hint: MessageKey, empty: MessageKey, itemLabel: MessageKey) => {
    const values = strings(card[field]);
    return <section className="opening-collection"><header><div><h2>{t(title)}</h2><p>{t(hint)}</p></div><button className="secondary" onClick={() => updateCollection(field, [...values, ""], values.length)}>{t("addOpening")}</button></header>
      {values.length === 0 && <p className="opening-empty">{t(empty)}</p>}
      <div className="opening-list">{values.map((value, index) => <article className={context.path === `${field}.${index}` || context.path === field ? "active" : ""} key={`${field}-${index}`}>
        <div className="opening-toolbar"><strong>{t(itemLabel)} {index + 1}</strong><div>
          <button onClick={() => { const next = [...values]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; updateCollection(field, next, index - 1); }} disabled={index === 0} aria-label={t("moveUp")} title={t("moveUp")}>↑</button>
          <button onClick={() => { const next = [...values]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; updateCollection(field, next, index + 1); }} disabled={index === values.length - 1} aria-label={t("moveDown")} title={t("moveDown")}>↓</button>
          <button onClick={() => { const next = [...values]; next.splice(index + 1, 0, value); updateCollection(field, next, index + 1); }} aria-label={t("duplicateOpening")} title={t("duplicateOpening")}>⧉</button>
          <button onClick={() => updateCollection(field, values.filter((_, itemIndex) => itemIndex !== index))} aria-label={t("removeOpening")} title={t("removeOpening")}>×</button>
        </div></div>
        <textarea rows={6} value={value} onFocus={(event) => focusText(`${field}.${index}`, event.currentTarget)} onSelect={(event) => focusText(`${field}.${index}`, event.currentTarget)} onChange={(event) => { const next = [...values]; next[index] = event.target.value; updateCollection(field, next, index); }} />
        <small>~{estimateTokens(value)} {t("approximateFieldTokens")}</small>
      </article>)}</div>
    </section>;
  };
  return <section className="scenes-page">
    <header className="scenes-heading"><div><p className="scenes-eyebrow">{selected.resource.metadata.name}</p><h1>{t("scenesTitle")}</h1><p>{t("scenesIntro")}</p></div><button className="secondary" onClick={onDraft}>{t("draftScenes")}</button></header>
    <aside className="scenes-guide"><strong>{t(castMode === "fixed-ensemble" ? "fixedEnsemble" : castMode === "dynamic-ensemble" ? "dynamicEnsemble" : "fixedSingle")}</strong><p>{t(castMode === "fixed-ensemble" ? "scenesFixedGuide" : castMode === "dynamic-ensemble" ? "scenesDynamicGuide" : "scenesSingleGuide")}</p></aside>
    <label className={`scenes-field ${context.path === "scenario" ? "active" : ""}`}><span><strong>{t("scenarioField")}</strong><small>{t("scenarioHint")}</small></span><textarea rows={10} value={card.scenario ?? ""} onFocus={(event) => focusText("scenario", event.currentTarget)} onSelect={(event) => focusText("scenario", event.currentTarget)} onChange={(event) => updateText("scenario", event.target.value, event.target.selectionStart)} /><em>~{estimateTokens(card.scenario ?? "")} {t("approximateFieldTokens")}</em></label>
    <label className={`scenes-field ${context.path === "first_mes" ? "active" : ""}`}><span><strong>{t("primaryGreeting")}</strong><small>{t("primaryGreetingHint")}</small></span><textarea rows={10} value={card.first_mes ?? ""} onFocus={(event) => focusText("first_mes", event.currentTarget)} onSelect={(event) => focusText("first_mes", event.currentTarget)} onChange={(event) => updateText("first_mes", event.target.value, event.target.selectionStart)} /><em>~{estimateTokens(card.first_mes ?? "")} {t("approximateFieldTokens")}</em></label>
    {collection("alternate_greetings", "alternateOpenings", "alternateOpeningsHint", "noAlternateOpenings", "openingNumber")}
    {collection("group_only_greetings", "groupOpenings", "groupOpeningsHint", "noGroupOpenings", "groupOpeningNumber")}
    <div className="scenes-save-bar"><span role="status">{status === "saved" ? t("scenesSaved") : status === "error" ? t("scenesSaveError") : dirty ? t("unsavedChanges") : ""}</span><button className="primary" onClick={onSave} disabled={!dirty || status === "saving"}>{status === "saving" ? t("saving") : t("saveScenes")}</button></div>
  </section>;
}
