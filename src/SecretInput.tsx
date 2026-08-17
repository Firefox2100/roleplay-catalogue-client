import { useState } from "react";
import type { MessageKey } from "./i18n";

export function SecretInput({ value, onChange, t }: { value: string; onChange: (value: string) => void; t: (key: MessageKey) => string }) {
  const [visible, setVisible] = useState(false);
  return <div className="secret-input"><input type={visible ? "text" : "password"} value={value} onChange={event => onChange(event.target.value)} autoComplete="off"/><button type="button" onClick={() => setVisible(value => !value)} aria-label={t(visible ? "hideKey" : "showKey")}>{visible ? "◉" : "○"}</button></div>;
}
