import type { MessageKey } from "./i18n";
import type { CharacterCardV3Data, EditorContext, JsonValue, SelectedCharacter } from "./types";
import "./OverviewPage.css";

type FieldKey = "name" | "description" | "personality" | "scenario" | "first_mes" | "mes_example" | "creator_notes" | "system_prompt" | "post_history_instructions" | "creator" | "character_version";

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

function objectValue(value: JsonValue | undefined): Record<string, JsonValue> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function arrayValue(value: JsonValue | undefined): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function cardStatistics(card: CharacterCardV3Data) {
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

export function OverviewPage({ selected, context, onContext, onChangeResource, t }: {
  selected: SelectedCharacter;
  context: EditorContext;
  onContext: (context: EditorContext) => void;
  onChangeResource: () => void;
  t: (key: MessageKey) => string;
}) {
  if (!selected.draft) return <section className="overview-page"><header className="overview-heading"><div><h1>{t("overviewTitle")}</h1><p>{t("noDraftOverview")}</p></div><button className="secondary" onClick={onChangeResource}>{t("changeResource")}</button></header></section>;
  const stats = cardStatistics(selected.draft.data);
  const filled = stats.fieldRows.filter((field) => field.filled).length;
  const completion = Math.round(filled / stats.fieldRows.length * 100);
  return <section className="overview-page">
    <header className="overview-heading"><div><p className="overview-eyebrow">{selected.resource.metadata.name}</p><h1>{t("overviewTitle")}</h1><p>{t("overviewIntro")}</p></div><button className="secondary" onClick={onChangeResource}>{t("changeResource")}</button></header>
    <div className="metric-grid">
      <article><span>{t("completion")}</span><strong>{completion}%</strong><div className="completion-track"><i style={{ width: `${completion}%` }} /></div></article>
      <article><span>{t("fieldsFilled")}</span><strong>{filled}/{stats.fieldRows.length}</strong></article>
      <article><span>{t("approximateTokens")}</span><strong>{stats.totalTokens.toLocaleString()}</strong></article>
      <article><span>{t("loreEntries")}</span><strong>{stats.entries.length}</strong></article>
    </div>
    <p className="estimate-note">{t("estimateDisclaimer")}</p>
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
  </section>;
}
