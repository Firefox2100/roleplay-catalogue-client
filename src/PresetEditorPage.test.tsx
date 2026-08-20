import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { PresetEditorPage } from "./PresetEditorPage";
import { selectedPreset } from "./test/fixtures";

const t = (key: string) => key;

it("edits prompt content and sends the precise field to assistant context", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const onContext = vi.fn();
  render(<PresetEditorPage selected={selectedPreset()} dirty status="idle" onChange={onChange} onContext={onContext} onDraft={vi.fn()} onSave={vi.fn()} t={t as never} />);

  const content = screen.getByRole("textbox", { name: /promptContent/ });
  await user.click(content);
  await user.clear(content);
  await user.type(content, "Write concisely.");
  expect(onContext).toHaveBeenCalledWith({ path: "preset.prompts.0.content", selectedText: "Stay in character.", cursor: null });
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ prompts: [expect.objectContaining({ content: expect.any(String) })] }));
});

it("adds an optional sampler and confirms prompt deletion", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<PresetEditorPage selected={selectedPreset()} dirty status="idle" onChange={onChange} onContext={vi.fn()} onDraft={vi.fn()} onSave={vi.fn()} t={t as never} />);

  await user.selectOptions(screen.getByRole("combobox", { name: "" }), "top_p");
  await user.click(screen.getByRole("button", { name: "addParameter" }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ top_p: 1 }));

  await user.click(screen.getByRole("button", { name: "remove" }));
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  const removeButtons = screen.getAllByRole("button", { name: "remove" });
  await user.click(removeButtons[removeButtons.length - 1]);
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ prompts: [] }));
});
