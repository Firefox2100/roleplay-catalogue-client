import type { MessageKey } from "./i18n";
import { estimateTokens } from "./OverviewPage";
import type { CharacterCardV3Data, EditorContext, SelectedCharacter, WorldOverview } from "./types";
import "./DialogueVoicePage.css";

const countMatches = (value: string, expression: RegExp) => value.match(expression)?.length ?? 0;

export function DialogueVoicePage({ selected, castMode, context, dirty, status, onChange, onContext, onDraft, onSave, t }: {
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
  if (!selected.draft) return <section className="dialogue-page"><p className="loading-text">{t("noDraftOverview")}</p></section>;
  const card = selected.draft.data;
  const value = typeof card.mes_example === "string" ? card.mes_example : "";
  const examples = countMatches(value, /(?:^|\n)\s*<START>\s*(?:\n|$)/gi);
  const characterTurns = countMatches(value, /(?:^|\n)\s*{{char}}\s*:/gi);
  const userTurns = countMatches(value, /(?:^|\n)\s*{{user}}\s*:/gi);
  const update = (next: string, cursor: number | null) => {
    onChange({ ...card, mes_example: next });
    onContext({ path: "mes_example", selectedText: next || null, cursor });
  };
  const select = (element: HTMLTextAreaElement) => {
    const selectedText = element.value.slice(element.selectionStart ?? 0, element.selectionEnd ?? 0);
    onContext({ path: "mes_example", selectedText: selectedText || element.value || null, cursor: element.selectionStart });
  };
  const addExample = () => {
    const separator = value.trim() ? "\n\n" : "";
    const next = `${value.trimEnd()}${separator}<START>\n{{user}}: \n{{char}}: `;
    update(next, next.length);
  };
  const guide = castMode === "fixed-ensemble" ? "dialogueFixedGuide" : castMode === "dynamic-ensemble" ? "dialogueDynamicGuide" : "dialogueSingleGuide";
  return <section className="dialogue-page">
    <header className="dialogue-heading"><div><p className="dialogue-eyebrow">{selected.resource.metadata.name}</p><h1>{t("dialogueVoiceTitle")}</h1><p>{t("dialogueVoiceIntro")}</p></div><button className="secondary" onClick={onDraft}>{t("draftDialogue")}</button></header>
    <aside className="dialogue-guide"><strong>{t(castMode === "fixed-ensemble" ? "fixedEnsemble" : castMode === "dynamic-ensemble" ? "dynamicEnsemble" : "fixedSingle")}</strong><p>{t(guide)}</p></aside>
    <section className="dialogue-metrics" aria-label={t("dialogueCoverage")}><article><strong>{examples}</strong><span>{t("exampleBlocks")}</span></article><article><strong>{characterTurns}</strong><span>{t("characterTurns")}</span></article><article><strong>{userTurns}</strong><span>{t("userTurns")}</span></article><article><strong>~{estimateTokens(value)}</strong><span>{t("approximateFieldTokens")}</span></article></section>
    <section className={`dialogue-editor ${context.path === "mes_example" ? "active" : ""}`}><header><div><h2>{t("exampleDialogueField")}</h2><p>{t("exampleDialogueHint")}</p></div><button className="secondary" onClick={addExample}>{t("addDialogueExample")}</button></header><textarea rows={22} value={value} onFocus={(event) => select(event.currentTarget)} onSelect={(event) => select(event.currentTarget)} onChange={(event) => update(event.target.value, event.target.selectionStart)} spellCheck /><footer><span>{t("dialogueFormatHint")}</span><em>~{estimateTokens(value)} {t("approximateFieldTokens")}</em></footer></section>
    <section className="dialogue-review"><h2>{t("voiceReview")}</h2><ul><li className={characterTurns > 0 ? "present" : "missing"}>{t(characterTurns > 0 ? "characterVoicePresent" : "characterVoiceMissing")}</li><li className={userTurns > 0 ? "present" : "missing"}>{t(userTurns > 0 ? "userTurnPresent" : "userTurnMissing")}</li><li className={examples > 0 ? "present" : "missing"}>{t(examples > 0 ? "exampleBoundaryPresent" : "exampleBoundaryMissing")}</li></ul></section>
    <div className="dialogue-save-bar"><span role="status">{status === "saved" ? t("dialogueSaved") : status === "error" ? t("dialogueSaveError") : dirty ? t("unsavedChanges") : ""}</span><button className="primary" onClick={onSave} disabled={!dirty || status === "saving"}>{status === "saving" ? t("saving") : t("saveDialogue")}</button></div>
  </section>;
}
