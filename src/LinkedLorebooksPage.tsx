import { useEffect, useState } from "react";
import { listLinkableLorebooks, saveLinkedLorebooks } from "./backend";
import { ConflictResolutionDialog } from "./ConflictResolutionDialog";
import type { MessageKey } from "./i18n";
import type { CatalogueResource, LinkableLorebook, LorebookReference, SelectedCharacter } from "./types";
import "./LinkedLorebooksPage.css";

const sameLinks = (left: LorebookReference[], right: LorebookReference[]) => JSON.stringify(left) === JSON.stringify(right);

export function LinkedLorebooksPage({ selected, onResource, t }: { selected: SelectedCharacter; onResource: (resource: CatalogueResource) => void; t: (key: MessageKey) => string }) {
  const [available, setAvailable] = useState<LinkableLorebook[]>([]);
  const [links, setLinks] = useState<LorebookReference[]>(selected.resource.linkedLorebooks ?? []);
  const [base, setBase] = useState<LorebookReference[]>(selected.resource.linkedLorebooks ?? []);
  const [revision, setRevision] = useState(selected.resource.revision);
  const [status, setStatus] = useState<"loading" | "idle" | "saving" | "saved" | "error">("loading");
  const [remoteConflict, setRemoteConflict] = useState<{ links: LorebookReference[]; revision: number } | null>(null);
  useEffect(() => { let active = true; void listLinkableLorebooks().then((items) => { if (active) { setAvailable(items); setStatus("idle"); } }).catch(() => active && setStatus("error")); return () => { active = false; }; }, []);
  const persist = async (next: LorebookReference[], expectedRevision: number, mergeBase = base): Promise<void> => {
    setStatus("saving");
    try {
      const outcome = await saveLinkedLorebooks(selected.resource.id, next, expectedRevision);
      if (outcome.saved) { setLinks(outcome.saved.linkedLorebooks); setBase(outcome.saved.linkedLorebooks); setRevision(outcome.saved.revision); setRemoteConflict(null); onResource(outcome.saved); setStatus("saved"); return; }
      if (!outcome.current) throw new Error("No current resource in conflict response");
      const remote = outcome.current.linkedLorebooks ?? [];
      if (sameLinks(next, remote) || sameLinks(remote, mergeBase)) { await persist(next, outcome.current.revision, remote); return; }
      if (sameLinks(next, mergeBase)) { setLinks(remote); setBase(remote); setRevision(outcome.current.revision); onResource(outcome.current); setStatus("saved"); return; }
      setRemoteConflict({ links: remote, revision: outcome.current.revision });
      setStatus("error");
    } catch { setStatus("error"); }
  };
  const select = (resourceId: string, value: string) => setLinks((current) => { const others = current.filter((link) => link.resourceId !== resourceId); return value ? [...others, { resourceId, versionId: value === "draft" ? null : value }] : others; });
  const move = (index: number, direction: -1 | 1) => setLinks((current) => { const target = index + direction; if (target < 0 || target >= current.length) return current; const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  return <section className="linked-page"><header><div><p>{selected.resource.metadata.name}</p><h1>{t("linkedLorebooks")}</h1><span>{t("linkedLorebooksIntro")}</span></div><aside><strong>{t("embeddedVersusLinked")}</strong><p>{t("embeddedVersusLinkedHint")}</p></aside></header>
    {status === "loading" ? <p className="loading-text">{t("loading")}</p> : <div className="linked-layout"><section className="link-candidates"><h2>{t("availableLorebooks")}</h2>{available.length ? available.map(({ resource, versions, draftEditable }) => { const link = links.find((item) => item.resourceId === resource.id); return <label key={resource.id}><span><strong>{resource.metadata.name}</strong><small>{resource.authorUsername}</small><small>{resource.metadata.description}</small></span><select value={link ? link.versionId ?? "draft" : ""} onChange={(event) => select(resource.id, event.target.value)}><option value="">{t("notLinked")}</option>{draftEditable && <option value="draft">{t("currentDraft")}</option>}{versions.map((version) => <option value={version.id} key={version.id}>{version.version} · {t(version.visibility)}</option>)}</select></label>; }) : <p className="linked-empty">{t("noLinkableLorebooks")}</p>}</section>
      <section className="link-order"><h2>{t("mergeOrder")}</h2><p>{t("mergeOrderHint")}</p>{links.length ? links.map((link, index) => { const book = available.find((item) => item.resource.id === link.resourceId); return <article key={link.resourceId}><span>{index + 1}</span><div><strong>{book?.resource.metadata.name ?? link.resourceId}</strong><small>{link.versionId ? book?.versions.find((version) => version.id === link.versionId)?.version ?? link.versionId : t("currentDraft")}</small></div><button onClick={() => move(index, -1)} disabled={index === 0}>↑</button><button onClick={() => move(index, 1)} disabled={index === links.length - 1}>↓</button></article>; }) : <p className="linked-empty">{t("noLinkedLorebooks")}</p>}</section></div>}
    <div className="extensions-save-bar"><span>{status === "saved" ? t("linkedLorebooksSaved") : status === "error" ? t("linkedLorebooksError") : !sameLinks(links, base) ? t("unsavedChanges") : ""}</span><button className="primary" disabled={status === "saving" || sameLinks(links, base)} onClick={() => void persist(links, revision)}>{status === "saving" ? t("saving") : t("saveLinkedLorebooks")}</button></div>
    {remoteConflict && <ConflictResolutionDialog conflicts={{ linkedLorebooks: { base, local: links, remote: remoteConflict.links } }} merged={{ linkedLorebooks: links }} saving={status === "saving"} onCancel={() => setRemoteConflict(null)} onApply={(resolved) => { const next = resolved.linkedLorebooks as LorebookReference[]; setLinks(next); void persist(next, remoteConflict.revision, remoteConflict.links); }} t={t} />}
  </section>;
}
