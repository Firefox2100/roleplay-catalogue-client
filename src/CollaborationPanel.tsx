import { useMemo, useState } from "react";
import { addResourceCoAuthor, removeResourceCoAuthor } from "./backend";
import type { CatalogueResource, CurrentUser } from "./types";
import type { MessageKey } from "./i18n";
import { Icon } from "./Icon";
import "./CollaborationPanel.css";

export function CollaborationPanel({ resource, currentUser, onResource, onLeave, t }: {
  resource: CatalogueResource;
  currentUser: CurrentUser | null;
  onResource: (resource: CatalogueResource) => void;
  onLeave: () => void;
  t: (key: MessageKey) => string;
}) {
  const [username, setUsername] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const owner = currentUser?.id === resource.authorId;
  const collaborators = useMemo(() => resource.coAuthorIds.map((id, index) => ({ id, username: resource.coAuthorUsernames?.[index] || id })), [resource.coAuthorIds, resource.coAuthorUsernames]);

  const add = async () => {
    const value = username.trim();
    if (!value || busyId) return;
    setBusyId("add"); setError("");
    try { onResource(await addResourceCoAuthor(resource.id, value)); setUsername(""); }
    catch { setError(t("coAuthorAddError")); }
    finally { setBusyId(""); }
  };

  const remove = async (id: string) => {
    if (busyId) return;
    setBusyId(id); setError("");
    try {
      const updated = await removeResourceCoAuthor(resource.id, id);
      if (id === currentUser?.id) onLeave(); else onResource(updated);
    } catch { setError(t("coAuthorRemoveError")); }
    finally { setBusyId(""); }
  };

  if (!currentUser || (!owner && collaborators.length === 0)) return null;
  return <section className="collaboration-panel" aria-labelledby="collaboration-title">
    <header><div><h2 id="collaboration-title">{t("collaboration")}</h2><p>{owner ? t("collaborationOwnerHint") : t("collaborationMemberHint")}</p></div><span>{collaborators.length}</span></header>
    {collaborators.length === 0 ? <p className="collaboration-empty">{t("noCoAuthors")}</p> : <ul>{collaborators.map((collaborator) => <li key={collaborator.id}><div><strong>{collaborator.username}</strong>{collaborator.id === currentUser.id && <small>{t("you")}</small>}</div>{(owner || collaborator.id === currentUser.id) && <button className="secondary" disabled={Boolean(busyId)} onClick={() => void remove(collaborator.id)}><Icon name="close" size={16} />{collaborator.id === currentUser.id ? t("leaveCollaboration") : t("removeCoAuthor")}</button>}</li>)}</ul>}
    {owner && <div className="collaboration-add"><label htmlFor="co-author-username">{t("coAuthorUsername")}</label><div><input id="co-author-username" maxLength={100} value={username} disabled={Boolean(busyId)} placeholder={t("coAuthorUsernamePlaceholder")} onChange={(event) => setUsername(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void add(); } }} /><button className="secondary" disabled={Boolean(busyId) || !username.trim()} onClick={() => void add()}>{busyId === "add" ? t("addingCoAuthor") : t("addCoAuthor")}</button></div></div>}
    {error && <p className="collaboration-error" role="alert">{error}</p>}
  </section>;
}
