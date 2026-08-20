import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import "./AppLayout.css";
import { AssetsPage } from "./AssetsPage";
import { AssistantDrawer } from "./AssistantDrawer";
import { saveCharacterDraft, saveLorebookDraft, loadBootstrap, loadWorldOverview, saveConfiguration, saveWorldOverview } from "./backend";
import { ConflictResolutionDialog } from "./ConflictResolutionDialog";
import { CharacterFoundationPage } from "./CharacterFoundationPage";
import { DialogueVoicePage } from "./DialogueVoicePage";
import { ExtensionsPage } from "./ExtensionsPage";
import { MetadataPage } from "./MetadataPage";
import { MvuComposerPage } from "./MvuComposerPage";
import { LorebookEditorPage } from "./LorebookEditorPage";
import { LinkedLorebooksPage } from "./LinkedLorebooksPage";
import { translate, type MessageKey } from "./i18n";
import { OverviewPage } from "./OverviewPage";
import { ResourcePicker } from "./ResourcePicker";
import { RuntimeInstructionsPage } from "./RuntimeInstructionsPage";
import { ScenarioOpeningsPage } from "./ScenarioOpeningsPage";
import { SecretInput } from "./SecretInput";
import type { AiProposal, AppConfig, AppearanceMode, BootstrapData, CharacterCardV3Data, CharacterDraft, EditorContext, LorebookData, LorebookDraft, ProviderKind, SelectedCharacter, SelectedLorebook, SelectedResource, WorldOverview } from "./types";
import { WorldOverviewPage } from "./WorldOverviewPage";
import { threeWayMerge, type MergeConflicts } from "./threeWayMerge";
import "./Theme.css";

type Page = "resources" | "overview" | "world" | "foundation" | "scenes" | "dialogue" | "runtime" | "metadata" | "lorebook" | "linked-lorebooks" | "extensions" | "mvu" | "assets" | "settings";
const desktopDefault = () => window.matchMedia("(min-width: 721px)").matches;
const fallback: BootstrapData = { version: "0.1.0", config: { locale: "en-GB", appearance: "system", llm: { provider: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "", model: "gpt-4.1", contextWindow: 128000, maxOutputTokens: 4096, temperature: 0.7 }, catalogue: { baseUrl: "", apiKey: "" } } };
const defaults: Record<ProviderKind, { baseUrl: string; model: string }> = { openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4.1" }, anthropic: { baseUrl: "https://api.anthropic.com", model: "claude-sonnet-4-5" }, ollama: { baseUrl: "http://127.0.0.1:11434", model: "llama3.2" }, "openai-compatible": { baseUrl: "", model: "" } };
const textProposalPaths = new Set(["name", "nickname", "description", "personality", "scenario", "first_mes", "mes_example", "creator_notes", "system_prompt", "post_history_instructions"]);
const collectionProposalPaths = new Set(["alternate_greetings", "group_only_greetings", "tags"]);

const applyLorebookProposal = (book: LorebookData, path: string, value: AiProposal["value"]): LorebookData | null => {
  const relative = path.replace(/^(lorebook|character_book)\./, "");
  if (relative === "name" || relative === "description") return typeof value === "string" ? { ...book, [relative]: value } : null;
  const match = relative.match(/^entries\.(\d+)\.(content|name|comment|keys|secondary_keys)$/);
  if (!match) return null;
  const index = Number(match[1]), field = match[2];
  if (!book.entries[index]) return null;
  const collection = field === "keys" || field === "secondary_keys";
  if (collection ? !Array.isArray(value) || !value.every((item) => typeof item === "string") : typeof value !== "string") return null;
  const entries = [...book.entries];
  entries[index] = { ...entries[index], [field]: value };
  return { ...book, entries };
};

function App() {
  const [page, setPage] = useState<Page>("resources");
  const [leftOpen, setLeftOpen] = useState(desktopDefault);
  const [rightOpen, setRightOpen] = useState(desktopDefault);
  const [data, setData] = useState(fallback);
  const [draft, setDraft] = useState<AppConfig>(fallback.config);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [selected, setSelected] = useState<SelectedResource | null>(null);
  const [worldOverview, setWorldOverview] = useState<WorldOverview | null>(null);
  const [worldStatus, setWorldStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [cardStatus, setCardStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [cardDirty, setCardDirty] = useState(false);
  const [cardBase, setCardBase] = useState<CharacterDraft | LorebookDraft | null>(null);
  const [mergeConflict, setMergeConflict] = useState<{ kind: "character" | "lorebook"; merged: CharacterCardV3Data | LorebookData; conflicts: MergeConflicts; remoteRevision: number; remoteData: CharacterCardV3Data | LorebookData } | null>(null);
  const [assistantPrompt, setAssistantPrompt] = useState<string | null>(null);
  const [editorContext, setEditorContext] = useState<EditorContext>({ path: null, selectedText: null, cursor: null });
  const t = useMemo(() => (key: MessageKey) => translate(draft.locale, key), [draft.locale]);

  useEffect(() => { loadBootstrap().then((value) => { setData(value); setDraft(value.config); }).catch(() => setStatus("error")); }, []);
  useEffect(() => { document.documentElement.lang = draft.locale; }, [draft.locale]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { document.documentElement.dataset.theme = draft.appearance === "system" ? (media.matches ? "dark" : "light") : draft.appearance; };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [draft.appearance]);
  useEffect(() => {
    if (!selected || selected.resource.resourceType !== "sillytavern/character") { setWorldOverview(null); return; }
    let current = true;
    setWorldStatus("idle");
    void loadWorldOverview(selected.resource.id).then((value) => { if (current) setWorldOverview(value); }).catch(() => { if (current) setWorldStatus("error"); });
    return () => { current = false; };
  }, [selected?.resource.id]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 721px)");
    const update = (event: MediaQueryListEvent) => { setLeftOpen(event.matches); setRightOpen(event.matches); };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const llm = <K extends keyof AppConfig["llm"]>(key: K, value: AppConfig["llm"][K]) => setDraft((current) => ({ ...current, llm: { ...current.llm, [key]: value } }));
  const provider = (kind: ProviderKind) => setDraft((current) => ({ ...current, llm: { ...current.llm, provider: kind, ...defaults[kind] } }));
  const go = (next: Page) => { setPage(next); if (!desktopDefault()) setLeftOpen(false); };
  const save = async () => { setStatus("saving"); try { const config = await saveConfiguration(draft); setDraft(config); setData((current) => ({ ...current, config })); setStatus("saved"); } catch { setStatus("error"); } };
  const selectResource = (value: SelectedResource) => { setSelected(value); setCardBase(value.draft); setCardDirty(false); setMergeConflict(null); setCardStatus("idle"); setEditorContext({ path: null, selectedText: null, cursor: null }); setPage(value.resource.resourceType === "sillytavern/lorebook" ? "lorebook" : "overview"); if (!desktopDefault()) setLeftOpen(false); };
  const changeResource = () => { setSelected(null); setCardBase(null); setWorldOverview(null); setCardDirty(false); setMergeConflict(null); setEditorContext({ path: null, selectedText: null, cursor: null }); setPage("resources"); };
  const persistWorldOverview = async (next = worldOverview) => {
    if (!next) return;
    setWorldStatus("saving");
    try { const saved = await saveWorldOverview(next); setWorldOverview(saved); setWorldStatus("saved"); } catch { setWorldStatus("error"); }
  };
  const acceptProposal = (proposal: AiProposal) => {
    if (proposal.path.startsWith("lorebook.")) {
      if (!selected?.draft || selected.resource.resourceType !== "sillytavern/lorebook") return false;
      const data = applyLorebookProposal(selected.draft.data as LorebookData, proposal.path, proposal.value);
      if (!data) return false;
      setSelected({ ...selected, draft: { ...selected.draft, data } } as SelectedLorebook);
      setCardDirty(true);
      setCardStatus("idle");
      return true;
    }
    if (proposal.path.startsWith("character_book.")) {
      if (!selected?.draft || selected.resource.resourceType !== "sillytavern/character") return false;
      const card = selected.draft.data as CharacterCardV3Data;
      if (!card.character_book) return false;
      const characterBook = applyLorebookProposal(card.character_book, proposal.path, proposal.value);
      if (!characterBook) return false;
      setSelected({ ...selected, draft: { ...selected.draft, data: { ...card, character_book: characterBook } } } as SelectedCharacter);
      setCardDirty(true);
      setCardStatus("idle");
      return true;
    }
    if (proposal.path.startsWith("worldOverview.") && worldOverview) {
      if (typeof proposal.value !== "string") return false;
      const key = proposal.path.slice("worldOverview.".length) as keyof WorldOverview;
      if (!new Set(["summary", "tone", "themes", "coreRules", "society", "technologyAndMagic", "history", "conflicts", "userRole", "intendedExperience", "constraints"]).has(key)) return false;
      const next = { ...worldOverview, [key]: proposal.value };
      setWorldOverview(next);
      setEditorContext({ path: proposal.path, selectedText: proposal.value, cursor: proposal.value.length });
      void persistWorldOverview(next);
      return true;
    }
    if (collectionProposalPaths.has(proposal.path)) {
      if (!Array.isArray(proposal.value) || !proposal.value.every((value) => typeof value === "string")) return false;
      setSelected((current) => current?.draft && current.resource.resourceType === "sillytavern/character" ? { ...current, draft: { ...current.draft, data: { ...(current.draft.data as CharacterCardV3Data), [proposal.path]: proposal.value } } } as SelectedCharacter : current);
      setCardDirty(true);
      setCardStatus("idle");
      setEditorContext({ path: proposal.path, selectedText: null, cursor: null });
      return true;
    }
    if (!textProposalPaths.has(proposal.path) || typeof proposal.value !== "string") return false;
    setSelected((current) => current?.draft && current.resource.resourceType === "sillytavern/character" ? { ...current, draft: { ...current.draft, data: { ...(current.draft.data as CharacterCardV3Data), [proposal.path]: proposal.value } } } as SelectedCharacter : current);
    setCardDirty(true);
    setCardStatus("idle");
    setEditorContext({ path: proposal.path, selectedText: proposal.value, cursor: proposal.value.length });
    return true;
  };
  const updateCard = (card: CharacterCardV3Data) => {
    setSelected((current) => current?.draft && current.resource.resourceType === "sillytavern/character" ? { ...current, draft: { ...current.draft, data: card } } as SelectedCharacter : current);
    setCardDirty(true);
    setCardStatus("idle");
  };
  const persistCharacter = async (data: CharacterCardV3Data, expectedRevision: number, mergeBase = (cardBase as CharacterDraft | null)?.data ?? data) => {
    if (!selected || selected.resource.resourceType !== "sillytavern/character") return;
    const outcome = await saveCharacterDraft(selected.resource.id, data, expectedRevision);
    if (!outcome.saved && outcome.current) {
      const withRemote = threeWayMerge(mergeBase as unknown as Record<string, unknown>, data as unknown as Record<string, unknown>, outcome.current.data as unknown as Record<string, unknown>);
      if (Object.keys(withRemote.conflicts).length === 0) return persistCharacter(withRemote.merged as unknown as CharacterCardV3Data, outcome.current.revision, outcome.current.data);
      setMergeConflict({ kind: "character", merged: withRemote.merged as unknown as CharacterCardV3Data, conflicts: withRemote.conflicts, remoteRevision: outcome.current.revision, remoteData: outcome.current.data });
      setCardStatus("error");
      return;
    }
    if (!outcome.saved) throw new Error("Catalogue save returned no draft");
    const saved = outcome.saved;
    setSelected((current) => current ? { ...current, draft: saved } as SelectedCharacter : current);
    setCardBase(saved);
    setCardDirty(false);
    setMergeConflict(null);
    setCardStatus("saved");
  };
  const saveCard = async () => {
    if (!selected?.draft || selected.resource.resourceType !== "sillytavern/character" || !cardDirty) return;
    setCardStatus("saving");
    try {
      await persistCharacter(selected.draft.data as CharacterCardV3Data, (cardBase as CharacterDraft | null)?.revision ?? selected.draft.revision);
    } catch { setCardStatus("error"); }
  };
  const updateStandaloneLorebook = (data: LorebookData) => {
    setSelected((current) => {
      if (!current || current.resource.resourceType !== "sillytavern/lorebook") return current;
      const draft = current.draft ? { ...current.draft, data } : { id: "", resourceId: current.resource.id, resourceVersionId: null, createdAt: "", updatedAt: "", data, revision: 0 };
      return { ...current, draft } as SelectedLorebook;
    });
    setCardDirty(true);
    setCardStatus("idle");
  };
  const persistLorebook = async (data: LorebookData, expectedRevision: number, mergeBase = (cardBase as LorebookDraft | null)?.data ?? data) => {
    if (!selected || selected.resource.resourceType !== "sillytavern/lorebook") return;
    const outcome = await saveLorebookDraft(selected.resource.id, data, expectedRevision);
    if (!outcome.saved && outcome.current) {
      const result = threeWayMerge(mergeBase as unknown as Record<string, unknown>, data as unknown as Record<string, unknown>, outcome.current.data as unknown as Record<string, unknown>);
      if (Object.keys(result.conflicts).length === 0) return persistLorebook(result.merged as unknown as LorebookData, outcome.current.revision, outcome.current.data);
      setMergeConflict({ kind: "lorebook", merged: result.merged as unknown as LorebookData, conflicts: result.conflicts, remoteRevision: outcome.current.revision, remoteData: outcome.current.data });
      setCardStatus("error");
      return;
    }
    if (!outcome.saved) throw new Error("Catalogue save returned no draft");
    const saved = outcome.saved;
    setSelected((current) => current ? { ...current, draft: saved } as SelectedLorebook : current);
    setCardBase(saved);
    setCardDirty(false);
    setMergeConflict(null);
    setCardStatus("saved");
  };
  const saveStandaloneLorebook = async () => {
    if (!selected?.draft || selected.resource.resourceType !== "sillytavern/lorebook" || !cardDirty) return;
    setCardStatus("saving");
    try {
      await persistLorebook(selected.draft.data as LorebookData, (cardBase as LorebookDraft | null)?.revision ?? selected.draft.revision);
    } catch { setCardStatus("error"); }
  };
  const mobile = !desktopDefault();
  const closeOverlay = () => { if (mobile) { setLeftOpen(false); setRightOpen(false); } };
  const shellClass = `app-shell ${leftOpen ? "left-open" : "left-closed"} ${rightOpen ? "right-open" : "right-closed"}`;
  const consumeAssistantPrompt = useCallback(() => setAssistantPrompt(null), []);

  if (!selected) return <div className={`app-shell resource-gate ${leftOpen ? "left-open" : "left-closed"} right-closed`}>
    {!leftOpen && <button className="drawer-launch drawer-launch--left" onClick={() => setLeftOpen(true)} aria-label={t("expandNav")}>☰</button>}
    {mobile && leftOpen && <button className="scrim" onClick={() => setLeftOpen(false)} aria-label={t("closeNav")} />}
    <aside className={`drawer ${leftOpen ? "drawer--open" : ""}`}>
      <div className="nav-list" />
      <footer className="drawer-footer"><div><strong>{t("appName")}</strong><small>v{data.version}</small></div><button className="icon-button" onClick={() => setLeftOpen(false)} aria-label={t("collapseNav")} title={t("collapseNav")}>‹</button><button className={`icon-button ${page === "settings" ? "active" : ""}`} onClick={() => { setPage("settings"); if (mobile) setLeftOpen(false); }} aria-label={t("openSettings")} title={t("settings")}>⚙</button></footer>
    </aside>
    <main className="page resource-gate-page">{page === "settings" ? <><button className="secondary resource-gate-back" onClick={() => setPage("resources")}>{t("backToResources")}</button><SettingsPage draft={draft} status={status} llm={llm} provider={provider} setDraft={setDraft} save={save} t={t} /></> : <ResourcePicker configured={Boolean(data.config.catalogue.baseUrl && data.config.catalogue.apiKey)} selected={null} locale={draft.locale} onSelected={selectResource} onOpenSettings={() => setPage("settings")} t={t} />}</main>
  </div>;

  const standaloneLorebook = selected.resource.resourceType === "sillytavern/lorebook" ? selected as SelectedLorebook : null;
  const selectedCharacter = standaloneLorebook ? null : selected as SelectedCharacter;
  const effectiveShellClass = shellClass;

  return <div className={effectiveShellClass}>
    {!leftOpen && <button className="drawer-launch drawer-launch--left" onClick={() => { setLeftOpen(true); if (mobile) setRightOpen(false); }} aria-label={t("expandNav")}>☰</button>}
    {!rightOpen && <button className="drawer-launch drawer-launch--right" onClick={() => { setRightOpen(true); if (mobile) setLeftOpen(false); }} aria-label={t("expandAssistant")}>✦</button>}
    {mobile && (leftOpen || rightOpen) && <button className="scrim" onClick={closeOverlay} aria-label={leftOpen ? t("closeNav") : t("closeAssistant")} />}

    <aside className={`drawer ${leftOpen ? "drawer--open" : ""}`}>
      <nav className="nav-list">
        <div className="drawer-top"><strong>{selected?.resource.metadata.name ?? t("resources")}</strong><button onClick={() => setLeftOpen(false)} aria-label={t("collapseNav")}>‹</button></div>
        {selectedCharacter && <><button className={page === "overview" ? "active" : ""} onClick={() => go("overview")}><span>◫</span>{t("overview")}</button>
        <button className={page === "world" ? "active" : ""} onClick={() => go("world")}><span>◎</span>{t("worldOverview")}</button>
        <button className={page === "foundation" ? "active" : ""} onClick={() => go("foundation")}><span>◇</span>{t("foundation")}</button>
        <button className={page === "scenes" ? "active" : ""} onClick={() => go("scenes")}><span>◈</span>{t("scenes")}</button>
        <button className={page === "dialogue" ? "active" : ""} onClick={() => go("dialogue")}><span>≋</span>{t("dialogueVoice")}</button>
        <button className={page === "runtime" ? "active" : ""} onClick={() => go("runtime")}><span>⌁</span>{t("runtimeInstructions")}</button>
        <button className={page === "metadata" ? "active" : ""} onClick={() => go("metadata")}><span>ⓘ</span>{t("metadata")}</button>
        <button className={page === "lorebook" ? "active" : ""} onClick={() => go("lorebook")}><span>▤</span>{t("embeddedLorebook")}</button>
        <button className={page === "linked-lorebooks" ? "active" : ""} onClick={() => go("linked-lorebooks")}><span>⛓</span>{t("linkedLorebooks")}</button>
        <button className={page === "extensions" ? "active" : ""} onClick={() => go("extensions")}><span>⌘</span>{t("extensionsAndScripts")}</button>
        <button className={page === "mvu" ? "active" : ""} onClick={() => go("mvu")}><span>↻</span>{t("mvuComposer")}</button>
        <button className={page === "assets" ? "active" : ""} onClick={() => go("assets")}><span>▧</span>{t("assetsAndCover")}</button></>}
        {standaloneLorebook && <button className={page === "lorebook" ? "active" : ""} onClick={() => go("lorebook")}><span>▤</span>{t("lorebookEditor")}</button>}
        {standaloneLorebook && <button className={page === "assets" ? "active" : ""} onClick={() => go("assets")}><span>▧</span>{t("assetsAndCover")}</button>}
        {standaloneLorebook && <button onClick={changeResource}><span>⇄</span>{t("changeResource")}</button>}
      </nav>
      <footer className="drawer-footer"><div><strong>{t("appName")}</strong><small>v{data.version}</small></div><button className={`icon-button ${page === "settings" ? "active" : ""}`} onClick={() => go("settings")} aria-label={t("openSettings")} title={t("settings")}>⚙</button></footer>
    </aside>

    <main className="page">
      {page === "overview" && selectedCharacter && <OverviewPage selected={selectedCharacter} conflict={null} context={editorContext} onContext={setEditorContext} onNavigate={go} onChangeResource={changeResource} onRetryConflict={() => undefined} onUseServerDraft={() => undefined} t={t} />}
      {page === "world" && selectedCharacter && worldOverview && <WorldOverviewPage value={worldOverview} status={worldStatus} context={editorContext} onChange={(value) => { setWorldOverview(value); setWorldStatus("idle"); }} onContext={setEditorContext} onSave={() => void persistWorldOverview()} onDraft={() => { setEditorContext({ path: "worldOverview.summary", selectedText: worldOverview.summary || null, cursor: null }); setAssistantPrompt(translate(selectedCharacter.resource.metadata.language === "zh-cn" ? "zh-CN" : "en-GB", "draftWorldPrompt")); setRightOpen(true); if (mobile) setLeftOpen(false); }} t={t} />}
      {page === "world" && selectedCharacter && !worldOverview && <p className="loading-text">{t("loading")}</p>}
      {page === "foundation" && selectedCharacter && <CharacterFoundationPage selected={selectedCharacter} castMode={worldOverview?.castMode ?? "fixed-single"} context={editorContext} dirty={cardDirty} status={cardStatus} onChange={updateCard} onContext={setEditorContext} onSave={() => void saveCard()} onDraft={() => { setEditorContext({ path: "description", selectedText: selectedCharacter.draft?.data.description || null, cursor: null }); setAssistantPrompt(translate(selectedCharacter.resource.metadata.language === "zh-cn" ? "zh-CN" : "en-GB", "draftFoundationPrompt")); setRightOpen(true); if (mobile) setLeftOpen(false); }} t={t} />}
      {page === "scenes" && selectedCharacter && <ScenarioOpeningsPage selected={selectedCharacter} castMode={worldOverview?.castMode ?? "fixed-single"} context={editorContext} dirty={cardDirty} status={cardStatus} onChange={updateCard} onContext={setEditorContext} onSave={() => void saveCard()} onDraft={() => { setEditorContext({ path: "scenario", selectedText: selectedCharacter.draft?.data.scenario || null, cursor: null }); setAssistantPrompt(translate(selectedCharacter.resource.metadata.language === "zh-cn" ? "zh-CN" : "en-GB", "draftScenesPrompt")); setRightOpen(true); if (mobile) setLeftOpen(false); }} t={t} />}
      {page === "dialogue" && selectedCharacter && <DialogueVoicePage selected={selectedCharacter} castMode={worldOverview?.castMode ?? "fixed-single"} context={editorContext} dirty={cardDirty} status={cardStatus} onChange={updateCard} onContext={setEditorContext} onSave={() => void saveCard()} onDraft={() => { setEditorContext({ path: "mes_example", selectedText: selectedCharacter.draft?.data.mes_example || null, cursor: null }); setAssistantPrompt(translate(selectedCharacter.resource.metadata.language === "zh-cn" ? "zh-CN" : "en-GB", "draftDialoguePrompt")); setRightOpen(true); if (mobile) setLeftOpen(false); }} t={t} />}
      {page === "runtime" && selectedCharacter && <RuntimeInstructionsPage selected={selectedCharacter} castMode={worldOverview?.castMode ?? "fixed-single"} context={editorContext} dirty={cardDirty} status={cardStatus} onChange={updateCard} onContext={setEditorContext} onSave={() => void saveCard()} onDraft={() => { setEditorContext({ path: "system_prompt", selectedText: selectedCharacter.draft?.data.system_prompt || null, cursor: null }); setAssistantPrompt(translate(selectedCharacter.resource.metadata.language === "zh-cn" ? "zh-CN" : "en-GB", "draftRuntimePrompt")); setRightOpen(true); if (mobile) setLeftOpen(false); }} t={t} />}
      {page === "metadata" && selectedCharacter && <MetadataPage selected={selectedCharacter} worldOverview={worldOverview} context={editorContext} dirty={cardDirty} status={cardStatus} onChange={updateCard} onContext={setEditorContext} onSave={() => void saveCard()} onSuggestTags={() => { const contentLocale = selectedCharacter.resource.metadata.language === "zh-cn" ? "zh-CN" : "en-GB"; setEditorContext({ path: "tags", selectedText: selectedCharacter.draft?.data.tags.join(", ") || null, cursor: null }); setAssistantPrompt(`${translate(contentLocale, "suggestMetadataTagsPrompt")}\n\n${translate(contentLocale, "metadataTagSources")}: ${JSON.stringify(selectedCharacter.resource.metadata.tags)}`); setRightOpen(true); if (mobile) setLeftOpen(false); }} t={t} />}
      {page === "lorebook" && selectedCharacter && <LorebookEditorPage value={selectedCharacter.draft?.data.character_book ?? null} fallbackName={selectedCharacter.resource.metadata.name} embedded dirty={cardDirty} status={cardStatus} onChange={(book) => selectedCharacter.draft && updateCard({ ...selectedCharacter.draft.data, character_book: book })} onContext={setEditorContext} onDraft={() => { setAssistantPrompt(translate(selectedCharacter.resource.metadata.language === "zh-cn" ? "zh-CN" : "en-GB", "draftLoreEntryPrompt")); setRightOpen(true); if (mobile) setLeftOpen(false); }} onSave={() => void saveCard()} t={t} />}
      {page === "lorebook" && standaloneLorebook && <LorebookEditorPage value={standaloneLorebook.draft?.data ?? null} fallbackName={standaloneLorebook.resource.metadata.name} embedded={false} dirty={cardDirty} status={cardStatus} onChange={updateStandaloneLorebook} onContext={setEditorContext} onDraft={() => { setAssistantPrompt(translate(standaloneLorebook.resource.metadata.language === "zh-cn" ? "zh-CN" : "en-GB", "draftLoreEntryPrompt")); setRightOpen(true); if (mobile) setLeftOpen(false); }} onSave={() => void saveStandaloneLorebook()} t={t} />}
      {page === "extensions" && selectedCharacter && <ExtensionsPage selected={selectedCharacter} dirty={cardDirty} status={cardStatus} onChange={updateCard} onContext={setEditorContext} onSave={() => void saveCard()} t={t} />}
      {page === "mvu" && selectedCharacter && <MvuComposerPage selected={selectedCharacter} dirty={cardDirty} status={cardStatus} onChange={updateCard} onSave={() => void saveCard()} t={t} />}
      {page === "linked-lorebooks" && selectedCharacter && <LinkedLorebooksPage selected={selectedCharacter} onResource={(resource) => setSelected((current) => current ? { ...current, resource } : current)} t={t} />}
      {page === "assets" && <AssetsPage selected={selected} dirty={cardDirty} status={cardStatus} onCardChange={selectedCharacter ? updateCard : null} onResource={(resource) => setSelected((current) => current ? { ...current, resource } : current)} onSave={() => void saveCard()} t={t} />}
      {page === "settings" && <SettingsPage draft={draft} status={status} llm={llm} provider={provider} setDraft={setDraft} save={save} t={t} />}
    </main>

    <AssistantDrawer open={rightOpen} onClose={() => setRightOpen(false)} selected={selected} worldOverview={selectedCharacter ? worldOverview : null} context={editorContext} draftPrompt={assistantPrompt} onDraftPromptUsed={consumeAssistantPrompt} providerConfigured={Boolean(data.config.llm.baseUrl && data.config.llm.model && (data.config.llm.provider === "ollama" || data.config.llm.apiKey))} onAccept={acceptProposal} onClearContext={() => setEditorContext({ path: null, selectedText: null, cursor: null })} t={t} />
    {mergeConflict && <ConflictResolutionDialog conflicts={mergeConflict.conflicts} merged={mergeConflict.merged as unknown as Record<string, unknown>} saving={cardStatus === "saving"} onCancel={() => setMergeConflict(null)} onApply={(resolved) => {
      setCardStatus("saving");
      const task = mergeConflict.kind === "character" ? persistCharacter(resolved as unknown as CharacterCardV3Data, mergeConflict.remoteRevision, mergeConflict.remoteData as CharacterCardV3Data) : persistLorebook(resolved as unknown as LorebookData, mergeConflict.remoteRevision, mergeConflict.remoteData as LorebookData);
      void task.catch(() => setCardStatus("error"));
    }} t={t} />}
  </div>;
}

function SettingsPage({ draft, status, llm, provider, setDraft, save, t }: { draft: AppConfig; status: "idle" | "saving" | "saved" | "error"; llm: <K extends keyof AppConfig["llm"]>(key: K, value: AppConfig["llm"][K]) => void; provider: (kind: ProviderKind) => void; setDraft: React.Dispatch<React.SetStateAction<AppConfig>>; save: () => Promise<void>; t: (key: MessageKey) => string }) {
  return <section className="settings-page"><div className="page-heading"><h1>{t("settingsTitle")}</h1><p>{t("settingsIntro")}</p></div>
    <section className="settings-card"><h2>{t("llm")}</h2><div className="form-grid"><label>{t("provider")}<select value={draft.llm.provider} onChange={(event) => provider(event.target.value as ProviderKind)}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="ollama">Ollama</option><option value="openai-compatible">OpenAI-compatible</option></select></label><label>{t("baseUrl")}<input type="url" value={draft.llm.baseUrl} onChange={(event) => llm("baseUrl", event.target.value)} /></label><label>{t("apiKey")}<SecretInput value={draft.llm.apiKey} onChange={(value) => llm("apiKey", value)} t={t} /><small>{t("apiKeyHint")}</small></label><label>{t("model")}<input list="known-models" value={draft.llm.model} onChange={(event) => llm("model", event.target.value)} /><datalist id="known-models"><option value="gpt-4.1" /><option value="gpt-4.1-mini" /><option value="claude-sonnet-4-5" /><option value="llama3.2" /></datalist></label><label>{t("contextWindow")}<input type="number" min="1024" value={draft.llm.contextWindow} onChange={(event) => llm("contextWindow", Number(event.target.value))} /></label><label>{t("maxOutput")}<input type="number" min="1" value={draft.llm.maxOutputTokens} onChange={(event) => llm("maxOutputTokens", Number(event.target.value))} /></label><label>{t("temperature")}<input type="number" min="0" max="2" step="0.1" value={draft.llm.temperature} onChange={(event) => llm("temperature", Number(event.target.value))} /></label></div></section>
    <section className="settings-card"><h2>{t("catalogue")}</h2><div className="form-grid"><label>{t("baseUrl")}<input type="url" value={draft.catalogue.baseUrl} onChange={(event) => setDraft((current) => ({ ...current, catalogue: { ...current.catalogue, baseUrl: event.target.value } }))} /></label><label>{t("apiKey")}<SecretInput value={draft.catalogue.apiKey} onChange={(value) => setDraft((current) => ({ ...current, catalogue: { ...current.catalogue, apiKey: value } }))} t={t} /></label></div></section>
    <section className="settings-card"><h2>{t("appearance")}</h2><div className="form-grid"><label>{t("themeMode")}<select value={draft.appearance} onChange={(event) => setDraft((current) => ({ ...current, appearance: event.target.value as AppearanceMode }))}><option value="system">{t("themeSystem")}</option><option value="light">{t("themeLight")}</option><option value="dark">{t("themeDark")}</option></select></label><label>{t("locale")}<select value={draft.locale} onChange={(event) => setDraft((current) => ({ ...current, locale: event.target.value as AppConfig["locale"] }))}><option value="en-GB">English (United Kingdom)</option><option value="zh-CN">简体中文</option></select></label></div></section>
    <div className="save-bar"><span role="status">{status === "saved" ? t("saved") : status === "error" ? t("saveError") : ""}</span><button className="primary" onClick={() => void save()} disabled={status === "saving"}>{status === "saving" ? t("saving") : t("save")}</button></div>
  </section>;
}

export default App;
