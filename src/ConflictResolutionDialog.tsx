import { useState } from "react";
import type { MessageKey } from "./i18n";
import type { MergeConflicts } from "./threeWayMerge";

const preview = (value: unknown) => typeof value === "string" ? value || "—" : JSON.stringify(value, null, 2) ?? "—";

export function ConflictResolutionDialog<T extends Record<string, unknown>>({ conflicts, merged, saving, onCancel, onApply, t }: {
  conflicts: MergeConflicts;
  merged: T;
  saving: boolean;
  onCancel: () => void;
  onApply: (value: T) => void;
  t: (key: MessageKey) => string;
}) {
  const fields = Object.keys(conflicts);
  const [choices, setChoices] = useState<Record<string, "local" | "remote">>(() => Object.fromEntries(fields.map((field) => [field, "local"])));
  const apply = () => onApply(Object.assign({}, merged, Object.fromEntries(fields.map((field) => [field, conflicts[field][choices[field]]]))) as T);
  return <div className="confirmation-layer conflict-resolution-layer"><section className="conflict-resolution-dialog" role="dialog" aria-modal="true" aria-labelledby="merge-conflict-title">
    <header><h2 id="merge-conflict-title">{t("mergeConflictTitle")}</h2><p>{t("mergeConflictBody")}</p></header>
    <div className="merge-conflict-fields">{fields.map((field) => <fieldset key={field}><legend>{field.replace(/_/g, " ")}</legend><div className="merge-options">
      {(["local", "remote"] as const).map((choice) => <label key={choice}><span><input type="radio" name={`merge-${field}`} checked={choices[field] === choice} onChange={() => setChoices((current) => ({ ...current, [field]: choice }))} />{t(choice === "local" ? "keepLocalValue" : "useRemoteValue")}</span><pre>{preview(conflicts[field][choice])}</pre></label>)}
    </div></fieldset>)}</div>
    <footer><button className="secondary" disabled={saving} onClick={onCancel}>{t("cancel")}</button><button className="primary" disabled={saving} onClick={apply}>{saving ? t("saving") : t("applyMerge")}</button></footer>
  </section></div>;
}
