import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { loadBootstrap, saveConfiguration } from "./backend";
import { translate, type MessageKey } from "./i18n";
import type { AppConfig, BootstrapData, ProviderKind } from "./types";
import type { SelectedCharacter } from "./types";
import { ResourcePicker } from "./ResourcePicker";
import { SecretInput } from "./SecretInput";

const fallback: BootstrapData = { version:"0.1.0", config:{ locale:"en-GB", llm:{ provider:"openai",baseUrl:"https://api.openai.com/v1",apiKey:"",model:"gpt-4.1",contextWindow:128000,maxOutputTokens:4096,temperature:0.7 }, catalogue:{baseUrl:"",apiKey:""} } };
const defaults: Record<ProviderKind,{baseUrl:string;model:string}> = { openai:{baseUrl:"https://api.openai.com/v1",model:"gpt-4.1"},anthropic:{baseUrl:"https://api.anthropic.com",model:"claude-sonnet-4-5"},ollama:{baseUrl:"http://127.0.0.1:11434",model:"llama3.2"},"openai-compatible":{baseUrl:"",model:""} };

function App() {
  const [page,setPage]=useState<"resources"|"settings">("resources"), [drawer,setDrawer]=useState(false), [data,setData]=useState(fallback), [draft,setDraft]=useState<AppConfig>(fallback.config), [status,setStatus]=useState<"idle"|"saving"|"saved"|"error">("idle");
  const [selected,setSelected]=useState<SelectedCharacter|null>(null);
  const t=useMemo(()=>(key:MessageKey)=>translate(draft.locale,key),[draft.locale]);
  useEffect(()=>{loadBootstrap().then(v=>{setData(v);setDraft(v.config)}).catch(()=>setStatus("error"))},[]);
  useEffect(()=>{document.documentElement.lang=draft.locale},[draft.locale]);
  const llm=<K extends keyof AppConfig["llm"]>(key:K,value:AppConfig["llm"][K])=>setDraft(v=>({...v,llm:{...v.llm,[key]:value}}));
  const provider=(kind:ProviderKind)=>setDraft(v=>({...v,llm:{...v.llm,provider:kind,...defaults[kind]}}));
  const go=(next:typeof page)=>{setPage(next);setDrawer(false)};
  const save=async()=>{setStatus("saving");try{const config=await saveConfiguration(draft);setDraft(config);setData(v=>({...v,config}));setStatus("saved")}catch{setStatus("error")}};
  return <div className="app-shell">
    <button className="mobile-menu" onClick={()=>setDrawer(true)} aria-label={t("openNav")}>☰</button>
    {drawer&&<button className="scrim" onClick={()=>setDrawer(false)} aria-label={t("closeNav")}/>}
    <aside className={`drawer ${drawer?"drawer--open":""}`}><nav className="nav-list"><button className={page==="resources"?"active":""} onClick={()=>go("resources")}><span>▦</span>{t("resources")}</button></nav><footer className="drawer-footer"><div><strong>{t("appName")}</strong><small>v{data.version}</small></div><button className={`icon-button ${page==="settings"?"active":""}`} onClick={()=>go("settings")} aria-label={t("openSettings")} title={t("settings")}>⚙</button></footer></aside>
    <main className="page">{page==="resources"?<ResourcePicker configured={Boolean(data.config.catalogue.baseUrl&&data.config.catalogue.apiKey)} selected={selected} onSelected={setSelected} t={t}/>:<section className="settings-page">
      <div className="page-heading"><h1>{t("settingsTitle")}</h1><p>{t("settingsIntro")}</p></div>
      <section className="settings-card"><h2>{t("llm")}</h2><div className="form-grid">
        <label>{t("provider")}<select value={draft.llm.provider} onChange={e=>provider(e.target.value as ProviderKind)}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="ollama">Ollama</option><option value="openai-compatible">OpenAI-compatible</option></select></label>
        <label>{t("baseUrl")}<input type="url" value={draft.llm.baseUrl} onChange={e=>llm("baseUrl",e.target.value)}/></label>
        <label>{t("apiKey")}<SecretInput value={draft.llm.apiKey} onChange={value=>llm("apiKey",value)} t={t}/><small>{t("apiKeyHint")}</small></label>
        <label>{t("model")}<input list="known-models" value={draft.llm.model} onChange={e=>llm("model",e.target.value)}/><datalist id="known-models"><option value="gpt-4.1"/><option value="gpt-4.1-mini"/><option value="claude-sonnet-4-5"/><option value="llama3.2"/></datalist></label>
        <label>{t("contextWindow")}<input type="number" min="1024" value={draft.llm.contextWindow} onChange={e=>llm("contextWindow",Number(e.target.value))}/></label>
        <label>{t("maxOutput")}<input type="number" min="1" value={draft.llm.maxOutputTokens} onChange={e=>llm("maxOutputTokens",Number(e.target.value))}/></label>
        <label>{t("temperature")}<input type="number" min="0" max="2" step="0.1" value={draft.llm.temperature} onChange={e=>llm("temperature",Number(e.target.value))}/></label>
      </div></section>
      <section className="settings-card"><h2>{t("catalogue")}</h2><div className="form-grid"><label>{t("baseUrl")}<input type="url" value={draft.catalogue.baseUrl} onChange={e=>setDraft(v=>({...v,catalogue:{...v.catalogue,baseUrl:e.target.value}}))}/></label><label>{t("apiKey")}<SecretInput value={draft.catalogue.apiKey} onChange={value=>setDraft(v=>({...v,catalogue:{...v.catalogue,apiKey:value}}))} t={t}/></label></div></section>
      <section className="settings-card"><h2>{t("locale")}</h2><label className="locale-field"><select value={draft.locale} onChange={e=>setDraft(v=>({...v,locale:e.target.value as AppConfig["locale"]}))}><option value="en-GB">English (United Kingdom)</option><option value="zh-CN">简体中文</option></select></label></section>
      <div className="save-bar"><span role="status">{status==="saved"?t("saved"):status==="error"?t("saveError"):""}</span><button className="primary" onClick={save} disabled={status==="saving"}>{status==="saving"?t("saving"):t("save")}</button></div>
    </section>}</main>
  </div>;
}
export default App;
