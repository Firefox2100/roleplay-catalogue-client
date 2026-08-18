import { useState } from "react";
import type { MessageKey } from "./i18n";
import { estimateTokens } from "./OverviewPage";
import type { CharacterCardV3Data, EditorContext, SelectedCharacter, WorldOverview } from "./types";
import "./MetadataPage.css";

const knownTags: Array<{ value: string; label: MessageKey }> = [
  { value: "Science Fiction", label: "tagScienceFiction" }, { value: "Near Future", label: "tagNearFuture" },
  { value: "Fantasy", label: "tagFantasy" }, { value: "Wuxia", label: "tagWuxia" },
  { value: "Xianxia", label: "tagXianxia" }, { value: "Historical", label: "tagHistorical" },
  { value: "Contemporary", label: "tagContemporary" }, { value: "Horror", label: "tagHorror" },
  { value: "Mystery", label: "tagMystery" }, { value: "Romance", label: "tagRomance" },
  { value: "Cyberpunk", label: "tagCyberpunk" }, { value: "Steampunk", label: "tagSteampunk" },
  { value: "Post-apocalyptic", label: "tagPostApocalyptic" }, { value: "Urban Fantasy", label: "tagUrbanFantasy" },
];

const unique = (values: string[]) => values.reduce<string[]>((items, value) => {
  const trimmed = value.trim();
  return trimmed && !items.some((item) => item.toLocaleLowerCase() === trimmed.toLocaleLowerCase()) ? [...items, trimmed] : items;
}, []);

export function MetadataPage({ selected, worldOverview, context, dirty, status, onChange, onContext, onSuggestTags, onSave, t }: {
  selected: SelectedCharacter;
  worldOverview: WorldOverview | null;
  context: EditorContext;
  dirty: boolean;
  status: "idle" | "saving" | "saved" | "error";
  onChange: (data: CharacterCardV3Data) => void;
  onContext: (context: EditorContext) => void;
  onSuggestTags: () => void;
  onSave: () => void;
  t: (key: MessageKey) => string;
}) {
  const [tag, setTag] = useState("");
  if (!selected.draft) return <section className="metadata-page"><p className="loading-text">{t("noDraftOverview")}</p></section>;
  const card = selected.draft.data;
  const tags = Array.isArray(card.tags) ? card.tags.filter((item): item is string => typeof item === "string") : [];
  const sourceTags = unique([...(selected.resource.metadata.tags ?? []), ...(worldOverview?.tags ?? [])]);
  const suggestions = sourceTags.filter((candidate) => !tags.some((item) => item.toLocaleLowerCase() === candidate.toLocaleLowerCase()));
  const tagLabel = (value: string) => {
    const known = knownTags.find((item) => item.value === value);
    return known ? t(known.label) : value;
  };
  const setTags = (next: string[]) => {
    onChange({ ...card, tags: unique(next) });
    onContext({ path: "tags", selectedText: next.join(", ") || null, cursor: null });
  };
  const addTag = (candidate: string) => {
    if (!candidate.trim()) return;
    setTags([...tags, candidate]);
    setTag("");
  };
  const updateText = (field: "creator" | "character_version" | "creator_notes", value: string, cursor: number | null) => {
    onChange({ ...card, [field]: value });
    onContext({ path: field, selectedText: value || null, cursor });
  };
  const selectText = (field: "creator" | "character_version" | "creator_notes", element: HTMLInputElement | HTMLTextAreaElement) => {
    const selectedText = element.value.slice(element.selectionStart ?? 0, element.selectionEnd ?? 0);
    onContext({ path: field, selectedText: selectedText || element.value || null, cursor: element.selectionStart });
  };
  return <section className="metadata-page">
    <header className="metadata-heading"><div><p className="metadata-eyebrow">{selected.resource.metadata.name}</p><h1>{t("metadataTitle")}</h1><p>{t("metadataIntro")}</p></div></header>
    <section className={`metadata-tags ${context.path === "tags" ? "active" : ""}`}><header><div><h2>{t("cardTags")}</h2><p>{t("cardTagsHint")}</p></div><button className="secondary" onClick={onSuggestTags}>{t("suggestTagsFromContent")}</button></header>
      <div className="metadata-selected-tags">{tags.map((item) => <button key={item} onClick={() => setTags(tags.filter((candidate) => candidate !== item))} title={`${t("removeTag")}: ${tagLabel(item)}`}>{tagLabel(item)}<span aria-hidden="true">×</span></button>)}</div>
      {tags.length === 0 && <p className="metadata-empty-tags">{t("noCardTags")}</p>}
      {suggestions.length > 0 && <div className="metadata-suggestions"><strong>{t("tagsFromPlanning")}</strong><div>{suggestions.map((item) => <button key={item} onClick={() => addTag(item)}>＋ {tagLabel(item)}</button>)}</div></div>}
      <div className="metadata-tag-input"><input value={tag} placeholder={t("customTag")} onChange={(event) => setTag(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addTag(tag); } }} /><button className="secondary" onClick={() => addTag(tag)} disabled={!tag.trim()}>{t("addTag")}</button></div>
    </section>
    <div className="metadata-identity-grid">
      <label className={`metadata-field ${context.path === "creator" ? "active" : ""}`}><span><strong>{t("creatorField")}</strong><small>{t("creatorHint")}</small></span><input value={card.creator ?? ""} onFocus={(event) => selectText("creator", event.currentTarget)} onSelect={(event) => selectText("creator", event.currentTarget)} onChange={(event) => updateText("creator", event.target.value, event.target.selectionStart)} /></label>
      <label className={`metadata-field ${context.path === "character_version" ? "active" : ""}`}><span><strong>{t("characterVersionField")}</strong><small>{t("characterVersionHint")}</small></span><input value={card.character_version ?? ""} onFocus={(event) => selectText("character_version", event.currentTarget)} onSelect={(event) => selectText("character_version", event.currentTarget)} onChange={(event) => updateText("character_version", event.target.value, event.target.selectionStart)} /></label>
    </div>
    <label className={`metadata-field ${context.path === "creator_notes" ? "active" : ""}`}><span><strong>{t("creatorNotesField")}</strong><small>{t("creatorNotesHint")}</small></span><textarea rows={12} value={card.creator_notes ?? ""} onFocus={(event) => selectText("creator_notes", event.currentTarget)} onSelect={(event) => selectText("creator_notes", event.currentTarget)} onChange={(event) => updateText("creator_notes", event.target.value, event.target.selectionStart)} /><em>~{estimateTokens(card.creator_notes ?? "")} {t("approximateFieldTokens")}</em></label>
    <aside className="metadata-source-note"><strong>{t("catalogueMetadata")}</strong><p>{t("catalogueMetadataHint")}</p></aside>
    <div className="metadata-save-bar"><span role="status">{status === "saved" ? t("metadataSaved") : status === "error" ? t("metadataSaveError") : dirty ? t("unsavedChanges") : ""}</span><button className="primary" onClick={onSave} disabled={!dirty || status === "saving"}>{status === "saving" ? t("saving") : t("saveMetadata")}</button></div>
  </section>;
}
