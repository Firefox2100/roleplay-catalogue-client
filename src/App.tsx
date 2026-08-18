import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import "./AppLayout.css";
import { AssistantDrawer } from "./AssistantDrawer";
import { loadBootstrap, loadWorldOverview, saveConfiguration, saveWorldOverview } from "./backend";
import { translate, type MessageKey } from "./i18n";
import { OverviewPage } from "./OverviewPage";
import { ResourcePicker } from "./ResourcePicker";
import { SecretInput } from "./SecretInput";
import type { AiProposal, AppConfig, BootstrapData, EditorContext, ProviderKind, SelectedCharacter, WorldOverview } from "./types";
import { WorldOverviewPage } from "./WorldOverviewPage";

type Page = "resources" | "overview" | "world" | "settings";
const desktopDefault = () => window.matchMedia("(min-width: 721px)").matches;
const fallback: BootstrapData = { version: "0.1.0", config: { locale: "en-GB", llm: { provider: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "", model: "gpt-4.1", contextWindow: 128000, maxOutputTokens: 4096, temperature: 0.7 }, catalogue: { baseUrl: "", apiKey: "" } } };
const defaults: Record<ProviderKind, { baseUrl: string; model: string }> = { openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4.1" }, anthropic: { baseUrl: "https://api.anthropic.com", model: "claude-sonnet-4-5" }, ollama: { baseUrl: "http://127.0.0.1:11434", model: "llama3.2" }, "openai-compatible": { baseUrl: "", model: "" } };
const proposalPaths = new Set(["name", "description", "personality", "scenario", "first_mes", "mes_example", "creator_notes", "system_prompt", "post_history_instructions"]);

function App() {
  const [page, setPage] = useState<Page>("resources");
  const [leftOpen, setLeftOpen] = useState(desktopDefault);
  const [rightOpen, setRightOpen] = useState(desktopDefault);
  const [data, setData] = useState(fallback);
  const [draft, setDraft] = useState<AppConfig>(fallback.config);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [selected, setSelected] = useState<SelectedCharacter | null>(null);
  const [worldOverview, setWorldOverview] = useState<WorldOverview | null>(null);
  const [worldStatus, setWorldStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [assistantPrompt, setAssistantPrompt] = useState<string | null>(null);
  const [editorContext, setEditorContext] = useState<EditorContext>({ path: null, selectedText: null, cursor: null });
  const t = useMemo(() => (key: MessageKey) => translate(draft.locale, key), [draft.locale]);

  useEffect(() => { loadBootstrap().then((value) => { setData(value); setDraft(value.config); }).catch(() => setStatus("error")); }, []);
  useEffect(() => { document.documentElement.lang = draft.locale; }, [draft.locale]);
  useEffect(() => {
    if (!selected) { setWorldOverview(null); return; }
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
  const selectResource = (value: SelectedCharacter) => { setSelected(value); setEditorContext({ path: null, selectedText: null, cursor: null }); setPage("overview"); if (!desktopDefault()) setLeftOpen(false); };
  const changeResource = () => { setSelected(null); setWorldOverview(null); setEditorContext({ path: null, selectedText: null, cursor: null }); setPage("resources"); };
  const persistWorldOverview = async (next = worldOverview) => {
    if (!next) return;
    setWorldStatus("saving");
    try { const saved = await saveWorldOverview(next); setWorldOverview(saved); setWorldStatus("saved"); } catch { setWorldStatus("error"); }
  };
  const acceptProposal = (proposal: AiProposal) => {
    if (proposal.path.startsWith("worldOverview.") && worldOverview) {
      const key = proposal.path.slice("worldOverview.".length) as keyof WorldOverview;
      if (!new Set(["summary", "tone", "themes", "coreRules", "society", "technologyAndMagic", "history", "conflicts", "userRole", "intendedExperience", "constraints"]).has(key)) return;
      const next = { ...worldOverview, [key]: proposal.value };
      setWorldOverview(next);
      setEditorContext({ path: proposal.path, selectedText: proposal.value, cursor: proposal.value.length });
      void persistWorldOverview(next);
      return;
    }
    if (!proposalPaths.has(proposal.path)) return;
    setSelected((current) => current?.draft ? { ...current, draft: { ...current.draft, data: { ...current.draft.data, [proposal.path]: proposal.value } } } : current);
    setEditorContext({ path: proposal.path, selectedText: proposal.value, cursor: proposal.value.length });
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
    <main className="page resource-gate-page">{page === "settings" ? <><button className="secondary resource-gate-back" onClick={() => setPage("resources")}>{t("backToResources")}</button><SettingsPage draft={draft} status={status} llm={llm} provider={provider} setDraft={setDraft} save={save} t={t} /></> : <ResourcePicker configured={Boolean(data.config.catalogue.baseUrl && data.config.catalogue.apiKey)} selected={null} onSelected={selectResource} onOpenSettings={() => setPage("settings")} t={t} />}</main>
  </div>;

  return <div className={shellClass}>
    {!leftOpen && <button className="drawer-launch drawer-launch--left" onClick={() => { setLeftOpen(true); if (mobile) setRightOpen(false); }} aria-label={t("expandNav")}>☰</button>}
    {!rightOpen && <button className="drawer-launch drawer-launch--right" onClick={() => { setRightOpen(true); if (mobile) setLeftOpen(false); }} aria-label={t("expandAssistant")}>✦</button>}
    {mobile && (leftOpen || rightOpen) && <button className="scrim" onClick={closeOverlay} aria-label={leftOpen ? t("closeNav") : t("closeAssistant")} />}

    <aside className={`drawer ${leftOpen ? "drawer--open" : ""}`}>
      <nav className="nav-list">
        <div className="drawer-top"><strong>{selected?.resource.metadata.name ?? t("resources")}</strong><button onClick={() => setLeftOpen(false)} aria-label={t("collapseNav")}>‹</button></div>
        <button className={page === "overview" ? "active" : ""} onClick={() => go("overview")}><span>◫</span>{t("overview")}</button>
        <button className={page === "world" ? "active" : ""} onClick={() => go("world")}><span>◎</span>{t("worldOverview")}</button>
      </nav>
      <footer className="drawer-footer"><div><strong>{t("appName")}</strong><small>v{data.version}</small></div><button className={`icon-button ${page === "settings" ? "active" : ""}`} onClick={() => go("settings")} aria-label={t("openSettings")} title={t("settings")}>⚙</button></footer>
    </aside>

    <main className="page">
      {page === "overview" && <OverviewPage selected={selected} context={editorContext} onContext={setEditorContext} onChangeResource={changeResource} t={t} />}
      {page === "world" && worldOverview && <WorldOverviewPage value={worldOverview} status={worldStatus} context={editorContext} onChange={(value) => { setWorldOverview(value); setWorldStatus("idle"); }} onContext={setEditorContext} onSave={() => void persistWorldOverview()} onDraft={() => { setEditorContext({ path: "worldOverview.summary", selectedText: worldOverview.summary || null, cursor: null }); setAssistantPrompt(t("draftWorldPrompt")); setRightOpen(true); if (mobile) setLeftOpen(false); }} t={t} />}
      {page === "world" && !worldOverview && <p className="loading-text">{t("loading")}</p>}
      {page === "settings" && <SettingsPage draft={draft} status={status} llm={llm} provider={provider} setDraft={setDraft} save={save} t={t} />}
    </main>

    <AssistantDrawer open={rightOpen} onClose={() => setRightOpen(false)} selected={selected} worldOverview={worldOverview} context={editorContext} draftPrompt={assistantPrompt} onDraftPromptUsed={consumeAssistantPrompt} providerConfigured={Boolean(data.config.llm.baseUrl && data.config.llm.model && (data.config.llm.provider === "ollama" || data.config.llm.apiKey))} onAccept={acceptProposal} t={t} />
  </div>;
}

function SettingsPage({ draft, status, llm, provider, setDraft, save, t }: { draft: AppConfig; status: "idle" | "saving" | "saved" | "error"; llm: <K extends keyof AppConfig["llm"]>(key: K, value: AppConfig["llm"][K]) => void; provider: (kind: ProviderKind) => void; setDraft: React.Dispatch<React.SetStateAction<AppConfig>>; save: () => Promise<void>; t: (key: MessageKey) => string }) {
  return <section className="settings-page"><div className="page-heading"><h1>{t("settingsTitle")}</h1><p>{t("settingsIntro")}</p></div>
    <section className="settings-card"><h2>{t("llm")}</h2><div className="form-grid"><label>{t("provider")}<select value={draft.llm.provider} onChange={(event) => provider(event.target.value as ProviderKind)}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="ollama">Ollama</option><option value="openai-compatible">OpenAI-compatible</option></select></label><label>{t("baseUrl")}<input type="url" value={draft.llm.baseUrl} onChange={(event) => llm("baseUrl", event.target.value)} /></label><label>{t("apiKey")}<SecretInput value={draft.llm.apiKey} onChange={(value) => llm("apiKey", value)} t={t} /><small>{t("apiKeyHint")}</small></label><label>{t("model")}<input list="known-models" value={draft.llm.model} onChange={(event) => llm("model", event.target.value)} /><datalist id="known-models"><option value="gpt-4.1" /><option value="gpt-4.1-mini" /><option value="claude-sonnet-4-5" /><option value="llama3.2" /></datalist></label><label>{t("contextWindow")}<input type="number" min="1024" value={draft.llm.contextWindow} onChange={(event) => llm("contextWindow", Number(event.target.value))} /></label><label>{t("maxOutput")}<input type="number" min="1" value={draft.llm.maxOutputTokens} onChange={(event) => llm("maxOutputTokens", Number(event.target.value))} /></label><label>{t("temperature")}<input type="number" min="0" max="2" step="0.1" value={draft.llm.temperature} onChange={(event) => llm("temperature", Number(event.target.value))} /></label></div></section>
    <section className="settings-card"><h2>{t("catalogue")}</h2><div className="form-grid"><label>{t("baseUrl")}<input type="url" value={draft.catalogue.baseUrl} onChange={(event) => setDraft((current) => ({ ...current, catalogue: { ...current.catalogue, baseUrl: event.target.value } }))} /></label><label>{t("apiKey")}<SecretInput value={draft.catalogue.apiKey} onChange={(value) => setDraft((current) => ({ ...current, catalogue: { ...current.catalogue, apiKey: value } }))} t={t} /></label></div></section>
    <section className="settings-card"><h2>{t("locale")}</h2><label className="locale-field"><select value={draft.locale} onChange={(event) => setDraft((current) => ({ ...current, locale: event.target.value as AppConfig["locale"] }))}><option value="en-GB">English (United Kingdom)</option><option value="zh-CN">简体中文</option></select></label></section>
    <div className="save-bar"><span role="status">{status === "saved" ? t("saved") : status === "error" ? t("saveError") : ""}</span><button className="primary" onClick={() => void save()} disabled={status === "saving"}>{status === "saving" ? t("saving") : t("save")}</button></div>
  </section>;
}

export default App;
