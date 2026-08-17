import { useCallback, useEffect, useId, useState } from "react";
import { createCharacter, fetchCharacterCover, listOwnedCharacters, selectCharacter } from "./backend";
import type { MessageKey } from "./i18n";
import type { CatalogueResource, CreateCharacterInput, SelectedCharacter } from "./types";
import "./ResourcePicker.css";

const emptyInput: CreateCharacterInput = { name: "", description: "", visibility: "private", tags: [] };

function ResourceCover({ resource }: { resource: CatalogueResource }) {
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setSource(null);
    if (!resource.coverImageResourceId) return () => { active = false; };
    void fetchCharacterCover(resource.id)
      .then((cover) => { if (active && cover) setSource(`data:${cover.mediaType};base64,${cover.data}`); })
      .catch((error) => console.warn(`Could not load cover for resource ${resource.id}`, error));
    return () => { active = false; };
  }, [resource.id, resource.coverImageResourceId]);

  if (source) return <img className="resource-cover" src={source} alt="" />;
  const initial = resource.metadata.name.trim().charAt(0).toLocaleUpperCase() || "◇";
  return <div className="resource-cover resource-cover--placeholder" aria-hidden="true"><span>{initial}</span></div>;
}

function ResourceCard({ resource, selected, busy, choose, t }: { resource: CatalogueResource; selected: boolean; busy: boolean; choose: (id: string) => Promise<void>; t: (key: MessageKey) => string }) {
  const tooltipId = useId(), description = resource.metadata.description.trim();
  return <article className={`resource-card ${selected ? "selected" : ""}`}>
    <ResourceCover resource={resource} />
    <div className="resource-card-body"><div className="resource-card-info" tabIndex={description ? 0 : undefined} aria-describedby={description ? tooltipId : undefined}>
      <div className="resource-card-title"><h2>{resource.metadata.name}</h2><span>{t(resource.metadata.visibility as "private" | "authenticated" | "public")}</span></div>
      {description && <div className="resource-tooltip" id={tooltipId} role="tooltip">{description}</div>}
    </div></div>
    <button onClick={() => void choose(resource.id)} disabled={busy || selected}>{selected ? t("selected") : busy ? t("loading") : t("select")}</button>
  </article>;
}

export function ResourcePicker({ configured, selected, onSelected, t }: { configured: boolean; selected: SelectedCharacter | null; onSelected: (value: SelectedCharacter) => void; t: (key: MessageKey) => string }) {
  const [resources, setResources] = useState<CatalogueResource[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState(""), [creating, setCreating] = useState(false), [form, setForm] = useState(emptyInput), [busyId, setBusyId] = useState("");
  const load = useCallback(async () => { if (!configured) return; setLoading(true); setError(""); try { setResources((await listOwnedCharacters()).items); } catch (reason) { setError(String(reason)); } finally { setLoading(false); } }, [configured]);
  useEffect(() => { void load(); }, [load]);
  const choose = async (id: string) => { setBusyId(id); setError(""); try { onSelected(await selectCharacter(id)); } catch (reason) { setError(String(reason)); } finally { setBusyId(""); } };
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusyId("create"); setError(""); try { const result = await createCharacter(form); onSelected(result); setResources((items) => [result.resource, ...items]); setCreating(false); setForm(emptyInput); } catch (reason) { setError(String(reason)); } finally { setBusyId(""); } };
  if (!configured) return <section className="empty-state"><div className="empty-icon">⚙</div><h1>{t("chooseTitle")}</h1><p>{t("configureCatalogue")}</p></section>;
  return <section className="resource-page"><div className="resource-heading"><div><h1>{t("chooseTitle")}</h1><p>{t("chooseIntro")}</p></div><div className="resource-actions"><button className="secondary" onClick={() => void load()} disabled={loading}>{t("refresh")}</button><button className="primary" onClick={() => setCreating(true)}>{t("create")}</button></div></div>
    {error && <div className="error-banner" role="alert"><strong>{t("resourceError")}</strong><span>{error}</span></div>}
    {loading ? <p className="loading-text">{t("loading")}</p> : resources.length === 0 ? <div className="resource-empty">{t("noResources")}</div> : <div className="resource-grid">{resources.map((resource) => <ResourceCard key={resource.id} resource={resource} selected={selected?.resource.id === resource.id} busy={busyId === resource.id} choose={choose} t={t} />)}</div>}
    {creating && <div className="dialog-layer" role="presentation"><form className="create-dialog" onSubmit={submit}><div className="dialog-heading"><h2>{t("newCharacter")}</h2><button type="button" className="close-button" onClick={() => setCreating(false)} aria-label={t("cancel")}>×</button></div><label>{t("name")}<input required maxLength={200} value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} /></label><label>{t("description")}<textarea maxLength={10000} value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} /></label><label>{t("tags")}<input value={form.tags.join(", ")} onChange={(event) => setForm((value) => ({ ...value, tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) }))} /><small>{t("tagsHint")}</small></label><label>{t("visibility")}<select value={form.visibility} onChange={(event) => setForm((value) => ({ ...value, visibility: event.target.value as CreateCharacterInput["visibility"] }))}><option value="private">{t("private")}</option><option value="authenticated">{t("authenticated")}</option><option value="public">{t("public")}</option></select></label><div className="dialog-actions"><button type="button" className="secondary" onClick={() => setCreating(false)}>{t("cancel")}</button><button className="primary" disabled={busyId === "create"}>{busyId === "create" ? t("creating") : t("createAction")}</button></div></form></div>}
  </section>;
}
