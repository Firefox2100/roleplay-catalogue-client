import { useMemo, useState } from "react";
import type { MessageKey } from "./i18n";
import type { CharacterCardV3Data, CharacterRegexScript, CharacterScript, JsonValue, LorebookData, LorebookEntry, SelectedCharacter } from "./types";
import "./MvuComposerPage.css";

type FieldType = "string" | "number" | "boolean" | "enum" | "list" | "record";
type MvuField = { id: string; name: string; type: FieldType; initial: string; description: string; minimum: number | null; maximum: number | null; options: string };
type MvuGroup = { id: string; name: string; description: string; fields: MvuField[] };
type MvuDesign = { version: 1; groups: MvuGroup[] };
type MvuBuild = { design: MvuDesign; variables: Record<string, JsonValue>; scripts: CharacterScript[]; entries: LorebookEntry[]; regexes: CharacterRegexScript[]; errors: string[] };

const DESIGN_KEY = "roleplay_catalogue_client_mvu";
const MARKER_KEY = "roleplayCatalogueClientArtifact";
const RUNTIME_MODULE = "https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js";
const SCHEMA_MODULE = "https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js";
const id = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const blankField = (): MvuField => ({ id: id(), name: "", type: "string", initial: "", description: "", minimum: null, maximum: null, options: "" });
const blankGroup = (): MvuGroup => ({ id: id(), name: "", description: "", fields: [blankField()] });
const marker = (kind: string): Record<string, JsonValue> => ({ [MARKER_KEY]: kind });
const hasMarker = (value: Record<string, JsonValue> | undefined, prefix = "mvu-") => typeof value?.[MARKER_KEY] === "string" && String(value[MARKER_KEY]).startsWith(prefix);
const parseJson = (text: string, fallback: JsonValue): JsonValue => { try { return JSON.parse(text) as JsonValue; } catch { return fallback; } };
const initialValue = (field: MvuField): JsonValue => {
  if (field.type === "number") return Number.isFinite(Number(field.initial)) ? Number(field.initial) : 0;
  if (field.type === "boolean") return field.initial === "true";
  if (field.type === "list") return parseJson(field.initial, []);
  if (field.type === "record") return parseJson(field.initial, {});
  return field.initial;
};
const storedDesign = (card: CharacterCardV3Data): MvuDesign | null => {
  const value = card.extensions[DESIGN_KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const groups = (value as Record<string, JsonValue>).groups;
  return Array.isArray(groups) ? value as unknown as MvuDesign : null;
};
const designFromVariables = (card: CharacterCardV3Data): MvuDesign => {
  const variables = card.extensions.tavern_helper?.variables ?? {};
  const groups = Object.entries(variables).map(([name, value]) => ({ id: id(), name, description: "", fields: value && typeof value === "object" && !Array.isArray(value) ? Object.entries(value).map(([fieldName, initial]) => ({ ...blankField(), name: fieldName, type: Array.isArray(initial) ? "list" as const : typeof initial === "number" ? "number" as const : typeof initial === "boolean" ? "boolean" as const : typeof initial === "object" ? "record" as const : "string" as const, initial: typeof initial === "string" ? initial : JSON.stringify(initial) })) : [{ ...blankField(), name: "value", initial: typeof value === "string" ? value : JSON.stringify(value) }] }));
  return { version: 1, groups: groups.length ? groups : [blankGroup()] };
};
const js = (value: unknown) => JSON.stringify(value);
const schemaFor = (design: MvuDesign) => {
  const fieldSchema = (field: MvuField) => {
    const initial = initialValue(field);
    if (field.type === "number") {
      const clamp = field.minimum !== null || field.maximum !== null ? `.transform(value => _.clamp(value, ${field.minimum ?? "-Infinity"}, ${field.maximum ?? "Infinity"}))` : "";
      return `z.coerce.number()${clamp}.prefault(${js(initial)})`;
    }
    if (field.type === "boolean") return `z.boolean().prefault(${js(initial)})`;
    if (field.type === "enum") { const options = field.options.split(",").map((value) => value.trim()).filter(Boolean); return `z.enum(${js(options)}).prefault(${js(options.includes(String(initial)) ? initial : options[0] ?? "")})`; }
    if (field.type === "list") return `z.array(z.string()).prefault(${js(Array.isArray(initial) ? initial : [])})`;
    if (field.type === "record") return `z.record(z.string(), z.unknown()).prefault(${js(initial && typeof initial === "object" && !Array.isArray(initial) ? initial : {})})`;
    return `z.string().prefault(${js(String(initial ?? ""))})`;
  };
  const groups = design.groups.filter((group) => group.name.trim()).map((group) => `  ${js(group.name.trim())}: z.object({\n${group.fields.filter((field) => field.name.trim()).map((field) => `    ${js(field.name.trim())}: ${fieldSchema(field)},`).join("\n")}\n  }).prefault({}),`).join("\n");
  return `import { registerMvuSchema } from ${js(SCHEMA_MODULE)};\n\nexport const Schema = z.object({\n${groups}\n});\n\n$(() => registerMvuSchema(Schema));`;
};
const yamlValue = (value: JsonValue) => typeof value === "string" ? JSON.stringify(value) : JSON.stringify(value);
const initialYaml = (variables: Record<string, JsonValue>) => Object.entries(variables).map(([group, value]) => `${JSON.stringify(group)}:\n${Object.entries(value as Record<string, JsonValue>).map(([field, initial]) => `  ${JSON.stringify(field)}: ${yamlValue(initial)}`).join("\n")}`).join("\n");
const rulesFor = (design: MvuDesign, chinese: boolean) => design.groups.filter((group) => group.name.trim()).map((group) => `${group.name}:\n${group.fields.filter((field) => field.name.trim()).map((field) => `  - ${field.name}: ${field.description.trim() || (chinese ? "仅在叙事事实发生变化时更新" : "Update only when the narrative establishes a change")}${field.type === "number" && (field.minimum !== null || field.maximum !== null) ? ` (${field.minimum ?? "−∞"}…${field.maximum ?? "∞"})` : ""}`).join("\n")}`).join("\n\n");
const loreEntry = (kind: string, comment: string, content: string, enabled: boolean, constant: boolean, order: number): LorebookEntry => ({ id: id(), keys: [], secondary_keys: [], content, extensions: { ...marker(kind), position: 4, depth: 0, prevent_recursion: true, exclude_recursion: true }, enabled, insertion_order: order, use_regex: false, constant, case_sensitive: null, name: comment, comment, selective: false, priority: null, position: "after_char" });
const characterScript = (kind: string, name: string, content: string): CharacterScript => ({ type: "script", enabled: true, name, id: id(), content, info: "", button: { enabled: false, buttons: [] }, data: marker(kind) });
const regexScript = (): CharacterRegexScript => ({ id: id(), scriptName: "MVU history window", findRegex: "/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/gm", replaceString: "", trimStrings: [], placement: [2], disabled: false, markdownOnly: false, promptOnly: true, runOnEdit: false, substituteRegex: 0, minDepth: 8, maxDepth: null, ...marker("mvu-history-filter") });

export function buildMvuPackage(design: MvuDesign, language: "en-uk" | "zh-cn"): MvuBuild {
  const errors: string[] = [];
  const groups = design.groups.filter((group) => group.name.trim());
  const groupNames = new Set<string>();
  const variables: Record<string, JsonValue> = {};
  groups.forEach((group) => {
    if (groupNames.has(group.name.trim())) errors.push(`Duplicate group: ${group.name.trim()}`);
    groupNames.add(group.name.trim());
    const values: Record<string, JsonValue> = {}, names = new Set<string>();
    group.fields.filter((field) => field.name.trim()).forEach((field) => {
      const path = `${group.name}.${field.name}`;
      if (names.has(field.name.trim())) errors.push(`Duplicate field: ${path}`);
      names.add(field.name.trim());
      if (field.type === "number" && !Number.isFinite(Number(field.initial))) errors.push(`Invalid number: ${path}`);
      if (field.type === "number" && field.minimum !== null && field.maximum !== null && field.minimum > field.maximum) errors.push(`Minimum exceeds maximum: ${path}`);
      if (field.type === "enum") { const options = field.options.split(",").map((value) => value.trim()).filter(Boolean); if (!options.length) errors.push(`Enum has no options: ${path}`); else if (!options.includes(field.initial)) errors.push(`Initial value is not an enum option: ${path}`); }
      if (field.type === "list" || field.type === "record") { try { const parsed = JSON.parse(field.initial); if (field.type === "list" ? !Array.isArray(parsed) : !parsed || typeof parsed !== "object" || Array.isArray(parsed)) errors.push(`Initial JSON has the wrong shape: ${path}`); } catch { errors.push(`Invalid initial JSON: ${path}`); } }
      values[field.name.trim()] = initialValue(field);
    });
    if (!Object.keys(values).length) errors.push(`Group has no fields: ${group.name}`);
    variables[group.name.trim()] = values;
  });
  if (!groups.length) errors.push("At least one named group is required");
  const chinese = language === "zh-cn";
  const outputContract = chinese ? "每次回复结束时，根据本轮新发生的事实审查变量。需要更新时输出一个 <UpdateVariable> 块，其中包含简短的 <Analysis> 和一个 <JSONPatch>。JSONPatch 必须是有效的 JSON 数组，路径从变量根开始，仅使用 add、replace、remove、move 操作。不要更新没有叙事依据的值。" : "At the end of each reply, review variables against facts newly established in that reply. When updates are needed, emit one <UpdateVariable> block containing concise <Analysis> and a <JSONPatch>. JSONPatch must be a valid JSON array whose paths start at the variable root and use only add, replace, remove, or move. Do not update values without narrative evidence.";
  return { design, variables, scripts: [characterScript("mvu-runtime", "MVU runtime", `await import(${js(RUNTIME_MODULE)});`), characterScript("mvu-schema", "MVU variable schema", schemaFor(design))], entries: [loreEntry("mvu-initial", "[initvar] Initial variables", initialYaml(variables), false, false, 180), loreEntry("mvu-current", "Current variables", "<current_variables>\n{{format_message_variable::stat_data}}\n</current_variables>", true, true, 190), loreEntry("mvu-rules", "[mvu_update] Variable rules", rulesFor(design, chinese), true, true, 200), loreEntry("mvu-output", "[mvu_update] Output contract", outputContract, true, true, 210)], regexes: [regexScript()], errors };
}

const applyPackage = (card: CharacterCardV3Data, build: MvuBuild): CharacterCardV3Data => {
  const helper = card.extensions.tavern_helper ?? { scripts: [], variables: {} };
  const previouslyManaged = new Set((storedDesign(card)?.groups ?? []).map((group) => group.name.trim()).filter(Boolean));
  const unmanagedVariables = Object.fromEntries(Object.entries(helper.variables).filter(([name]) => !previouslyManaged.has(name)));
  const book: LorebookData = card.character_book ?? { name: `${card.name} lore`, description: "", scan_depth: null, token_budget: null, recursive_scanning: false, extensions: {}, entries: [] };
  return { ...card, character_book: { ...book, entries: [...book.entries.filter((entry) => !hasMarker(entry.extensions)), ...build.entries] }, extensions: { ...card.extensions, [DESIGN_KEY]: build.design as unknown as JsonValue, regex_scripts: [...card.extensions.regex_scripts.filter((script) => !hasMarker(script as unknown as Record<string, JsonValue>)), ...build.regexes], tavern_helper: { ...helper, variables: { ...unmanagedVariables, ...build.variables }, scripts: [...helper.scripts.filter((script) => !hasMarker(script.data)), ...build.scripts] } } };
};
const removePackage = (card: CharacterCardV3Data): CharacterCardV3Data => { const helper = card.extensions.tavern_helper ?? { scripts: [], variables: {} }; const managedGroups = new Set((storedDesign(card)?.groups ?? []).map((group) => group.name.trim()).filter(Boolean)); const extensions = { ...card.extensions }; delete extensions[DESIGN_KEY]; return { ...card, character_book: card.character_book ? { ...card.character_book, entries: card.character_book.entries.filter((entry) => !hasMarker(entry.extensions)) } : null, extensions: { ...extensions, regex_scripts: card.extensions.regex_scripts.filter((script) => !hasMarker(script as unknown as Record<string, JsonValue>)), tavern_helper: { ...helper, variables: Object.fromEntries(Object.entries(helper.variables).filter(([name]) => !managedGroups.has(name))), scripts: helper.scripts.filter((script) => !hasMarker(script.data)) } } }; };

export function MvuComposerPage({ selected, dirty, status, onChange, onSave, t }: { selected: SelectedCharacter; dirty: boolean; status: "idle" | "saving" | "saved" | "error"; onChange: (value: CharacterCardV3Data) => void; onSave: () => void; t: (key: MessageKey) => string }) {
  const card = selected.draft?.data;
  const [design, setDesign] = useState<MvuDesign>(() => card ? storedDesign(card) ?? designFromVariables(card) : { version: 1, groups: [blankGroup()] });
  const [confirm, setConfirm] = useState<"apply" | "remove" | null>(null);
  const build = useMemo(() => buildMvuPackage(design, selected.resource.metadata.language), [design, selected.resource.metadata.language]);
  if (!card) return <section className="mvu-page"><h1>{t("mvuComposer")}</h1><p>{t("noDraftOverview")}</p></section>;
  const updateGroup = (groupId: string, patch: Partial<MvuGroup>) => setDesign((current) => ({ ...current, groups: current.groups.map((group) => group.id === groupId ? { ...group, ...patch } : group) }));
  const updateField = (groupId: string, fieldId: string, patch: Partial<MvuField>) => setDesign((current) => ({ ...current, groups: current.groups.map((group) => group.id === groupId ? { ...group, fields: group.fields.map((field) => field.id === fieldId ? { ...field, ...patch } : field) } : group) }));
  const installed = Boolean(storedDesign(card));
  return <section className="mvu-page"><header className="mvu-heading"><div><p>{selected.resource.metadata.name}</p><h1>{t("mvuComposer")}</h1><span>{t("mvuComposerIntro")}</span></div><div className={`mvu-install-state ${installed ? "installed" : ""}`}><strong>{t(installed ? "mvuInstalled" : "mvuNotInstalled")}</strong><small>{t("mvuInstallStateHint")}</small></div></header>
    <section className="mvu-model"><header><div><h2>{t("variableModel")}</h2><p>{t("variableModelHint")}</p></div><button className="primary" onClick={() => setDesign((current) => ({ ...current, groups: [...current.groups, blankGroup()] }))}>{t("addVariableGroup")}</button></header>{design.groups.map((group, groupIndex) => <article className="mvu-group" key={group.id}><header><span>{groupIndex + 1}</span><input aria-label={t("groupName")} placeholder={t("groupName")} value={group.name} onChange={(event) => updateGroup(group.id, { name: event.target.value })} /><input aria-label={t("groupPurpose")} placeholder={t("groupPurpose")} value={group.description} onChange={(event) => updateGroup(group.id, { description: event.target.value })} /><button className="danger-outline" onClick={() => setDesign((current) => ({ ...current, groups: current.groups.filter((item) => item.id !== group.id) }))}>{t("remove")}</button></header><div className="mvu-fields">{group.fields.map((field) => <div className="mvu-field" key={field.id}><input aria-label={t("variableName")} placeholder={t("variableName")} value={field.name} onChange={(event) => updateField(group.id, field.id, { name: event.target.value })} /><select aria-label={t("variableType")} value={field.type} onChange={(event) => updateField(group.id, field.id, { type: event.target.value as FieldType })}><option value="string">{t("textType")}</option><option value="number">{t("numberType")}</option><option value="boolean">{t("booleanType")}</option><option value="enum">{t("enumType")}</option><option value="list">{t("arrayType")}</option><option value="record">{t("objectType")}</option></select><input aria-label={t("initialValue")} placeholder={field.type === "list" ? "[]" : field.type === "record" ? "{}" : t("initialValue")} value={field.initial} onChange={(event) => updateField(group.id, field.id, { initial: event.target.value })} /><input className="mvu-field-description" aria-label={t("updateCondition")} placeholder={t("updateCondition")} value={field.description} onChange={(event) => updateField(group.id, field.id, { description: event.target.value })} />{field.type === "number" && <><input type="number" aria-label={t("minimumValue")} placeholder={t("minimumValue")} value={field.minimum ?? ""} onChange={(event) => updateField(group.id, field.id, { minimum: event.target.value === "" ? null : Number(event.target.value) })} /><input type="number" aria-label={t("maximumValue")} placeholder={t("maximumValue")} value={field.maximum ?? ""} onChange={(event) => updateField(group.id, field.id, { maximum: event.target.value === "" ? null : Number(event.target.value) })} /></>}{field.type === "enum" && <input className="mvu-field-options" aria-label={t("enumOptions")} placeholder={t("enumOptions")} value={field.options} onChange={(event) => updateField(group.id, field.id, { options: event.target.value })} />}<button className="icon-button" aria-label={t("remove")} onClick={() => updateGroup(group.id, { fields: group.fields.filter((item) => item.id !== field.id) })}>×</button></div>)}</div><button className="secondary mvu-add-field" onClick={() => updateGroup(group.id, { fields: [...group.fields, blankField()] })}>{t("addVariable")}</button></article>)}</section>
    <section className="mvu-preview"><header><div><h2>{t("packagePreview")}</h2><p>{t("packagePreviewHint")}</p></div><div><span>{build.scripts.length} {t("characterScripts")}</span><span>{build.entries.length} {t("loreEntries")}</span><span>{build.regexes.length} {t("regexScripts")}</span></div></header>{build.errors.length > 0 && <div className="mvu-errors" role="alert"><strong>{t("packageProblems")}</strong><ul>{build.errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}<div className="mvu-preview-grid"><article><h3>{t("initialStatePreview")}</h3><pre>{JSON.stringify(build.variables, null, 2)}</pre></article><article><h3>{t("affectedArtifacts")}</h3><ul>{build.scripts.map((script) => <li key={String(script.id)}><strong>{t("characterScript")}</strong>{script.name}</li>)}{build.entries.map((entry) => <li key={String(entry.id)}><strong>{t("entry")}</strong>{entry.comment}</li>)}{build.regexes.map((regex) => <li key={String(regex.id)}><strong>{t("regexScript")}</strong>{regex.scriptName}</li>)}</ul></article></div><footer><p>{t("ownedArtifactHint")}</p><div>{installed && <button className="danger-outline" onClick={() => setConfirm("remove")}>{t("removeMvuPackage")}</button>}<button className="primary" disabled={build.errors.length > 0} onClick={() => setConfirm("apply")}>{t(installed ? "updateMvuPackage" : "installMvuPackage")}</button></div></footer></section>
    <div className="extensions-save-bar"><span>{status === "saved" ? t("extensionsSaved") : status === "error" ? t("extensionsSaveError") : dirty ? t("unsavedChanges") : ""}</span><button className="primary" disabled={!dirty || status === "saving"} onClick={onSave}>{status === "saving" ? t("saving") : t("saveExtensions")}</button></div>
    {confirm && <div className="confirmation-layer"><section className="confirmation-dialog" role="alertdialog" aria-modal="true"><h2>{t(confirm === "apply" ? "applyMvuTitle" : "removeMvuTitle")}</h2><p>{t(confirm === "apply" ? "applyMvuBody" : "removeMvuBody")}</p><div><button className="secondary" autoFocus onClick={() => setConfirm(null)}>{t("cancel")}</button><button className={confirm === "apply" ? "primary" : "danger-button"} onClick={() => { onChange(confirm === "apply" ? applyPackage(card, build) : removePackage(card)); setConfirm(null); }}>{t(confirm === "apply" ? "applyPackage" : "removeMvuPackage")}</button></div></section></div>}
  </section>;
}
