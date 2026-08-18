import { useState } from "react";
import type { MessageKey } from "./i18n";
import type { EditorContext, WorldOverview } from "./types";
import "./WorldOverviewPage.css";

const commonTags: Array<{ value: string; label: MessageKey }> = [
  { value: "Science Fiction", label: "tagScienceFiction" }, { value: "Near Future", label: "tagNearFuture" },
  { value: "Fantasy", label: "tagFantasy" }, { value: "Wuxia", label: "tagWuxia" },
  { value: "Xianxia", label: "tagXianxia" }, { value: "Historical", label: "tagHistorical" },
  { value: "Contemporary", label: "tagContemporary" }, { value: "Horror", label: "tagHorror" },
  { value: "Mystery", label: "tagMystery" }, { value: "Romance", label: "tagRomance" },
  { value: "Cyberpunk", label: "tagCyberpunk" }, { value: "Steampunk", label: "tagSteampunk" },
  { value: "Post-apocalyptic", label: "tagPostApocalyptic" }, { value: "Urban Fantasy", label: "tagUrbanFantasy" },
];

const structures: Array<{ value: WorldOverview["castMode"]; title: MessageKey; description: MessageKey; focus: MessageKey }> = [
  { value: "fixed-single", title: "fixedSingle", description: "fixedSingleDescription", focus: "fixedSingleFocus" },
  { value: "fixed-ensemble", title: "fixedEnsemble", description: "fixedEnsembleDescription", focus: "fixedEnsembleFocus" },
  { value: "dynamic-ensemble", title: "dynamicEnsemble", description: "dynamicEnsembleDescription", focus: "dynamicEnsembleFocus" },
];

const fields: Array<{ key: Exclude<keyof WorldOverview, "resourceId" | "castMode" | "tags" | "updatedAt">; label: MessageKey; hint: MessageKey; rows: number }> = [
  { key: "summary", label: "worldSummary", hint: "worldSummaryHint", rows: 7 },
  { key: "tone", label: "worldTone", hint: "worldToneHint", rows: 4 },
  { key: "themes", label: "worldThemes", hint: "worldThemesHint", rows: 4 },
  { key: "coreRules", label: "worldRules", hint: "worldRulesHint", rows: 6 },
  { key: "society", label: "worldSociety", hint: "worldSocietyHint", rows: 6 },
  { key: "technologyAndMagic", label: "worldTechnologyMagic", hint: "worldTechnologyMagicHint", rows: 6 },
  { key: "history", label: "worldHistory", hint: "worldHistoryHint", rows: 5 },
  { key: "conflicts", label: "worldConflicts", hint: "worldConflictsHint", rows: 5 },
  { key: "userRole", label: "worldUserRole", hint: "worldUserRoleHint", rows: 4 },
  { key: "intendedExperience", label: "worldExperience", hint: "worldExperienceHint", rows: 4 },
  { key: "constraints", label: "worldConstraints", hint: "worldConstraintsHint", rows: 4 },
];

export function WorldOverviewPage({ value, status, context, onChange, onContext, onSave, onDraft, t }: {
  value: WorldOverview;
  status: "idle" | "saving" | "saved" | "error";
  context: EditorContext;
  onChange: (value: WorldOverview) => void;
  onContext: (context: EditorContext) => void;
  onSave: () => void;
  onDraft: () => void;
  t: (key: MessageKey) => string;
}) {
  const [tag, setTag] = useState("");
  const addTag = (candidate: string) => {
    const next = candidate.trim();
    if (!next || value.tags.some((item) => item.toLocaleLowerCase() === next.toLocaleLowerCase())) return;
    onChange({ ...value, tags: [...value.tags, next] });
    setTag("");
  };
  const removeTag = (candidate: string) => onChange({ ...value, tags: value.tags.filter((item) => item !== candidate) });
  const tagLabel = (tagValue: string) => {
    const common = commonTags.find((item) => item.value === tagValue);
    return common ? t(common.label) : tagValue;
  };
  return <section className="world-overview-page">
    <header className="world-overview-heading"><div><h1>{t("worldOverviewTitle")}</h1><p>{t("worldOverviewIntro")}</p><small>{t("worldOverviewLocal")}</small></div><button className="secondary" onClick={onDraft}>{t("draftWorldWithAssistant")}</button></header>
    <section className="world-section structure-section"><div className="world-field-heading"><h2>{t("characterStructure")}</h2><p>{t("characterStructureHint")}</p></div><div className="structure-grid">{structures.map((structure) => <label key={structure.value} className={value.castMode === structure.value ? "selected" : ""}><input type="radio" name="cast-mode" value={structure.value} checked={value.castMode === structure.value} onChange={() => onChange({ ...value, castMode: structure.value })} /><span><strong>{t(structure.title)}</strong><small>{t(structure.description)}</small><em>{t("templateFocus")}</em><small>{t(structure.focus)}</small></span></label>)}</div></section>
    <section className="world-section world-tags-section"><div className="world-field-heading"><div><h2>{t("worldTags")}</h2><p>{t("worldTagsHint")}</p></div></div>
      <div className="selected-world-tags">{value.tags.map((item) => <button key={item} onClick={() => removeTag(item)} title={`${t("removeTag")}: ${tagLabel(item)}`}>{tagLabel(item)}<span aria-hidden="true">×</span></button>)}</div>
      <div className="common-world-tags">{commonTags.filter((item) => !value.tags.includes(item.value)).map((item) => <button key={item.value} onClick={() => addTag(item.value)}>{t(item.label)}</button>)}</div>
      <div className="custom-tag-input"><input value={tag} placeholder={t("customTag")} onChange={(event) => setTag(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addTag(tag); } }} /><button className="secondary" onClick={() => addTag(tag)} disabled={!tag.trim()}>{t("addTag")}</button></div>
    </section>
    <div className="world-field-list">{fields.map((field) => {
      const path = `worldOverview.${field.key}`;
      return <label key={field.key} className={`world-section world-text-field ${context.path === path ? "active" : ""}`}><span className="world-field-heading"><span><strong>{t(field.label)}</strong><small>{t(field.hint)}</small></span></span><textarea rows={field.rows} value={value[field.key]} onFocus={(event) => onContext({ path, selectedText: event.currentTarget.value || null, cursor: event.currentTarget.selectionStart })} onSelect={(event) => onContext({ path, selectedText: event.currentTarget.value.slice(event.currentTarget.selectionStart, event.currentTarget.selectionEnd) || event.currentTarget.value || null, cursor: event.currentTarget.selectionStart })} onChange={(event) => { onChange({ ...value, [field.key]: event.target.value }); onContext({ path, selectedText: event.target.value || null, cursor: event.target.selectionStart }); }} /></label>;
    })}</div>
    <div className="world-save-bar"><span role="status">{status === "saved" ? t("worldOverviewSaved") : status === "error" ? t("worldOverviewError") : ""}</span><button className="primary" onClick={onSave} disabled={status === "saving"}>{status === "saving" ? t("saving") : t("saveWorldOverview")}</button></div>
  </section>;
}
