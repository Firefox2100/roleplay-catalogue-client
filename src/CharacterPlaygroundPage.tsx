import { useCallback, useEffect, useRef, useState } from "react";
import { previewCharacterPlayground, runCharacterPlayground } from "./backend";
import type { MessageKey } from "./i18n";
import type { CharacterPlaygroundResult, PlaygroundMessage, SelectedCharacter } from "./types";
import "./CharacterPlaygroundPage.css";

const initialMessages = (selected: SelectedCharacter): PlaygroundMessage[] => {
  const greeting = selected.draft?.data.first_mes.trim();
  return greeting ? [{ role: "assistant", content: greeting }] : [];
};

export function CharacterPlaygroundPage({ selected, providerConfigured, t }: { selected: SelectedCharacter; providerConfigured: boolean; t: (key: MessageKey) => string }) {
  const [messages, setMessages] = useState<PlaygroundMessage[]>(() => initialMessages(selected));
  const [message, setMessage] = useState("");
  const [userName, setUserName] = useState("User");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<CharacterPlaygroundResult | null>(null);
  const previewSequence = useRef(0);
  const previewTimer = useRef<number | null>(null);
  const preview = useCallback((immediate = false) => {
    if (!selected.draft) return;
    if (previewTimer.current !== null) window.clearTimeout(previewTimer.current);
    const sequence = ++previewSequence.current;
    const run = () => {
      previewTimer.current = null;
      const previewMessages = message.trim() ? [...messages, { role: "user", content: message.trim() } satisfies PlaygroundMessage] : messages;
      void previewCharacterPlayground({ draft: selected.draft!.data, messages: previewMessages, userName: userName.trim() || "User" }).then((next) => { if (previewSequence.current === sequence) setResult(next); }).catch(() => undefined);
    };
    if (immediate) run();
    else previewTimer.current = window.setTimeout(run, 300);
  }, [message, messages, selected.draft, userName]);
  useEffect(() => { setMessages(initialMessages(selected)); setResult(null); setError(""); setStatus("idle"); }, [selected.resource.id, selected.draft?.revision]);
  useEffect(() => {
    preview();
    return () => { if (previewTimer.current !== null) window.clearTimeout(previewTimer.current); };
  }, [preview]);
  const reset = () => { setMessages(initialMessages(selected)); setResult(null); setError(""); setStatus("idle"); };
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = message.trim();
    if (!content || !selected.draft || status === "sending") return;
    const next = [...messages, { role: "user", content } satisfies PlaygroundMessage];
    setMessages(next); setMessage(""); setError(""); setStatus("sending");
    try {
      const response = await runCharacterPlayground({ draft: selected.draft.data, messages: next, userName: userName.trim() || "User" });
      setResult(response); setMessages((current) => [...current, { role: "assistant", content: response.reply }]); setStatus("idle");
    } catch (reason) { setError(String(reason)); setStatus("error"); }
  };
  if (!selected.draft) return <section className="playground-page"><h1>{t("playgroundTitle")}</h1><p>{t("noDraftOverview")}</p></section>;
  return <section className="playground-page">
    <header><div><p>{selected.resource.metadata.name}</p><h1>{t("playgroundTitle")}</h1><span>{t("playgroundIntro")}</span></div><button className="secondary" onClick={reset}>{t("resetTrial")}</button></header>
    <div className="playground-identity"><label>{t("trialUserName")}<input value={userName} maxLength={80} onChange={(event) => setUserName(event.target.value)} /></label></div>
    <div className="playground-layout"><section className="playground-chat" aria-label={t("trialConversation")}>
      <div className="playground-messages">{messages.length ? messages.map((item, index) => <article key={index} className={item.role}><strong>{item.role === "assistant" ? selected.draft!.data.name || t("character") : userName || t("user")}</strong><p>{item.content}</p></article>) : <div className="playground-empty">{t("trialEmpty")}</div>}{status === "sending" && <div className="playground-pending" role="status">{t("generatingTrial")}</div>}</div>
      {error && <p className="release-blocker" role="alert">{error}</p>}
      {!providerConfigured && <p className="release-blocker" role="alert">{t("configureProviderForTrial")}</p>}
      <form onSubmit={(event) => void send(event)}><label className="trial-message">{t("trialMessage")}<textarea rows={3} value={message} onChange={(event) => setMessage(event.target.value)} onBlur={() => preview(true)} /></label><button className="primary" disabled={!providerConfigured || !message.trim() || status === "sending"}>{status === "sending" ? t("generatingTrial") : t("sendTrialMessage")}</button></form>
    </section><aside className="playground-inspector"><h2>{t("trialInspector")}</h2><p>{t("trialInspectorHint")}</p><dl><div><dt>{t("approximateTokens")}</dt><dd>{result?.approximateInputTokens.toLocaleString() ?? "—"}</dd></div><div><dt>{t("activatedLoreEntries")}</dt><dd>{result?.activatedLore.length ?? 0}</dd></div></dl>{result?.activatedLore.length ? <ul>{result.activatedLore.map((entry) => <li key={`${entry.id}-${entry.position}`}><strong>{entry.name}</strong><small>{entry.position === "after_char" ? t("afterCharacter") : t("beforeCharacter")}</small></li>)}</ul> : <p className="muted">{t("noActivatedLore")}</p>}<details open><summary>{t("renderedPrompt")}</summary><pre>{result?.renderedPrompt ?? t("sendToInspectPrompt")}</pre></details></aside></div>
  </section>;
}
