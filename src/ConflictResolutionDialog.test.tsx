import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ConflictResolutionDialog } from "./ConflictResolutionDialog";

const t = (key: string) => ({ keepLocalValue: "Keep mine", useRemoteValue: "Use theirs", applyMerge: "Apply merge" }[key] ?? key);

it("lets the writer resolve each conflict before applying the merged draft", async () => {
  const user = userEvent.setup();
  const onApply = vi.fn();
  render(<ConflictResolutionDialog
    conflicts={{ name: { base: "Base", local: "Mine", remote: "Theirs" } }}
    merged={{ name: "Mine", description: "Independently merged" }}
    saving={false} onCancel={vi.fn()} onApply={onApply} t={t as never}
  />);

  await user.click(screen.getByText("Use theirs"));
  await user.click(screen.getByRole("button", { name: "Apply merge" }));
  expect(onApply).toHaveBeenCalledWith({ name: "Theirs", description: "Independently merged" });
});

it("prevents dismissing or applying while the resolved draft is saving", () => {
  render(<ConflictResolutionDialog conflicts={{ name: { base: "A", local: "B", remote: "C" } }} merged={{ name: "B" }} saving onCancel={vi.fn()} onApply={vi.fn()} t={t as never} />);
  expect(screen.getByRole("button", { name: "cancel" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "saving" })).toBeDisabled();
});
