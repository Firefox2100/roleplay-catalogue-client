import { useEffect, useMemo, useRef, useState } from "react";
import { deleteAiConversation, listAiConversations, sendAiMessage } from "./backend";
import type { MessageKey } from "./i18n";
import type { AiConversation, AiProposal, EditorContext, SelectedCharacter, WorldOverview } from "./types";
import "./AssistantDrawer.css";

export function AssistantDrawer({ open, onClose, selected, worldOverview, context, draftPrompt, onDraftPromptUsed, providerConfigured, onAccept, onClearContext, t }: {
  open: boolean;
  onClose: () => void;
  selected: SelectedCharacter | null;
  worldOverview: WorldOverview | null;
  context: EditorContext;
  draftPrompt: string | null;
  onDraftPromptUsed: () => void;
  providerConfigured: boolean;
  onAccept: (proposal: AiProposal) => void;
  onClearContext: () => void;
  t: (key: MessageKey) => string;
}) {
  const resourceId = selected?.resource.id ?? null;
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const endRef = useRef<HTMLDivElement>(null);
  const active = useMemo(() => conversations.find((item) => item.id === activeId) ?? null, [conversations, activeId]);

  useEffect(() => {
    let current = true;
    setActiveId(null);
    setError("");
    void listAiConversations(resourceId).then((items) => {
      if (!current) return;
      setConversations(items);
      setActiveId(items[0]?.id ?? null);
    }).catch((reason) => current && setError(String(reason)));
    return () => { current = false; };
  }, [resourceId]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [active?.messages.length, busy]);
  useEffect(() => {
    if (!draftPrompt) return;
    setMessage(draftPrompt);
    onDraftPromptUsed();
  }, [draftPrompt, onDraftPromptUsed]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim() || busy || !providerConfigured) return;
    setBusy(true);
    setError("");
    const outgoing = message;
    const requestConversationId = activeId;
    const optimisticConversationId = requestConversationId ?? `pending-conversation-${Date.now()}`;
    const optimisticMessage = {
      id: `pending-message-${Date.now()}`,
      conversationId: optimisticConversationId,
      role: "user" as const,
      content: outgoing.trim(),
      proposals: [],
      createdAt: new Date().toISOString(),
    };
    const optimisticConversation: AiConversation = active
      ? { ...active, updatedAt: optimisticMessage.createdAt, messages: [...active.messages, optimisticMessage] }
      : { id: optimisticConversationId, resourceId, title: outgoing.trim().slice(0, 60), createdAt: optimisticMessage.createdAt, updatedAt: optimisticMessage.createdAt, messages: [optimisticMessage] };
    setMessage("");
    setConversations((items) => [optimisticConversation, ...items.filter((item) => item.id !== optimisticConversationId)]);
    setActiveId(optimisticConversationId);
    try {
      const conversation = await sendAiMessage({
        conversationId: requestConversationId,
        resourceId,
        resourceLanguage: selected?.resource.metadata.language ?? "en-uk",
        message: outgoing,
        draft: selected?.draft?.data ?? null,
        worldOverview,
        selection: context.path ? context : null,
      });
      setConversations((items) => [conversation, ...items.filter((item) => item.id !== conversation.id && item.id !== optimisticConversationId)]);
      setActiveId(conversation.id);
    } catch (reason) {
      setError(String(reason));
      try {
        const items = await listAiConversations(resourceId);
        setConversations(items);
        setActiveId(items[0]?.id ?? null);
      } catch {
        setMessage(outgoing);
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!active || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deleteAiConversation(active.id);
      const remaining = conversations.filter((item) => item.id !== active.id);
      setConversations(remaining);
      setActiveId(remaining[0]?.id ?? null);
      setDeleteOpen(false);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setDeleteBusy(false);
    }
  };

  const accept = (proposal: AiProposal) => {
    onAccept(proposal);
    setAccepted((items) => new Set(items).add(proposal.id));
  };
  const proposalText = (proposal: AiProposal) => typeof proposal.value === "string" ? proposal.value : JSON.stringify(proposal.value, null, 2);

  return <><aside className={`assistant-drawer ${open ? "assistant-drawer--open" : ""}`} aria-label={t("assistant")}>
    <header className="assistant-header"><div><strong>{t("assistant")}</strong><small>{context.path ? `${t("currentContext")}: ${context.path}` : t("entireDraft")}</small></div><button className="assistant-close" onClick={onClose} aria-label={t("collapseAssistant")}>›</button></header>
    <div className="conversation-toolbar"><select aria-label={t("assistant")} value={activeId ?? ""} onChange={(event) => setActiveId(event.target.value || null)}><option value="">{t("newChat")}</option>{conversations.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><button onClick={() => setActiveId(null)} title={t("newChat")} aria-label={t("newChat")}>＋</button><button onClick={() => setDeleteOpen(true)} disabled={!active || busy} title={t("deleteChat")} aria-label={t("deleteChat")}>⌫</button></div>
    <div className="assistant-context"><span>{context.path ? context.path : t("entireDraft")}</span>{context.path && <button onClick={onClearContext}>{t("clearSelection")}</button>}</div>
    <div className="message-list">{!active?.messages.length && <div className="assistant-empty"><div>✦</div><p>{providerConfigured ? t("chatEmpty") : t("providerNeeded")}</p></div>}{active?.messages.map((item) => <article key={item.id} className={`chat-message chat-message--${item.role}`}><div className="chat-content">{item.content}</div>{item.proposals.map((proposal) => <section className="proposal-card" key={proposal.id}><header><strong>{t("proposedChange")}</strong><code>{proposal.path}</code></header>{proposal.rationale && <p>{proposal.rationale}</p>}<pre>{proposalText(proposal)}</pre><button onClick={() => accept(proposal)} disabled={accepted.has(proposal.id) || !selected}>{accepted.has(proposal.id) ? t("proposalApplied") : t("applyProposal")}</button></section>)}</article>)}{busy && <div className="assistant-thinking">{t("sending")}</div>}<div ref={endRef} /></div>
    {error && <div className="assistant-error" role="alert">{error}</div>}
    <form className="assistant-compose" onSubmit={submit}><textarea rows={3} value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={t("chatPlaceholder")} disabled={!providerConfigured} /><button className="primary" disabled={busy || !message.trim() || !providerConfigured}>{busy ? t("sending") : t("send")}</button></form>
  </aside>{deleteOpen && active && <div className="confirmation-layer" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleteBusy) setDeleteOpen(false); }}><section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-conversation-title" aria-describedby="delete-conversation-body" onKeyDown={(event) => { if (event.key === "Escape" && !deleteBusy) setDeleteOpen(false); }}><h2 id="delete-conversation-title">{t("deleteChatTitle")}</h2><p id="delete-conversation-body">{t("deleteChatBody")}</p><div><button className="secondary" autoFocus onClick={() => setDeleteOpen(false)} disabled={deleteBusy}>{t("cancel")}</button><button className="danger-button" onClick={() => void remove()} disabled={deleteBusy}>{deleteBusy ? t("deleting") : t("deleteChat")}</button></div></section></div>}</>;
}
