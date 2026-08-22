import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { CharacterPlaygroundPage } from "./CharacterPlaygroundPage";
import { characterData, selectedCharacter } from "./test/fixtures";

const backend = vi.hoisted(() => ({ runCharacterPlayground: vi.fn(), previewCharacterPlayground: vi.fn().mockResolvedValue({ reply: "", activatedLore: [], renderedPrompt: "Live prompt", approximateInputTokens: 12 }) }));
vi.mock("./backend", () => backend);
const t = (key: string) => key;

it("shows the user turn immediately and then exposes activated lore from the result", async () => {
  const user = userEvent.setup();
  let finish!: (value: { reply: string; activatedLore: Array<{ id: string; name: string; position: "before_char" | "after_char" }>; renderedPrompt: string; approximateInputTokens: number }) => void;
  backend.runCharacterPlayground.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const selected = selectedCharacter(characterData({ first_mes: "Welcome to the harbour." }));
  render(<CharacterPlaygroundPage selected={selected} providerConfigured t={t as never} />);

  expect(screen.getByText("Welcome to the harbour.")).toBeInTheDocument();
  await user.type(screen.getByRole("textbox", { name: "trialMessage" }), "Is the signal active?");
  await user.click(screen.getByRole("button", { name: "sendTrialMessage" }));
  expect(screen.getByText("Is the signal active?")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("generatingTrial");

  finish({ reply: "It is active.", activatedLore: [{ id: "1", name: "Harbour signal", position: "before_char" }], renderedPrompt: "Rendered", approximateInputTokens: 42 });
  expect(await screen.findByText("It is active.")).toBeInTheDocument();
  expect(screen.getByText("Harbour signal")).toBeInTheDocument();
  expect(screen.getByText("42")).toBeInTheDocument();
  expect(backend.runCharacterPlayground).toHaveBeenCalledWith(expect.objectContaining({ messages: expect.arrayContaining([expect.objectContaining({ role: "user", content: "Is the signal active?" })]) }));
});

it("assembles the prompt after the draft message settles without sending it", async () => {
  const user = userEvent.setup();
  render(<CharacterPlaygroundPage selected={selectedCharacter()} providerConfigured t={t as never} />);
  await user.type(screen.getByRole("textbox", { name: "trialMessage" }), "Draft turn");
  await waitFor(() => expect(backend.previewCharacterPlayground).toHaveBeenLastCalledWith(expect.objectContaining({ messages: expect.arrayContaining([expect.objectContaining({ role: "user", content: "Draft turn" })]) })));
  expect(await screen.findByText("12")).toBeInTheDocument();
  expect(backend.runCharacterPlayground).not.toHaveBeenCalled();
});

it("immediately assembles the complete prompt when the message field loses focus", async () => {
  const user = userEvent.setup();
  render(<CharacterPlaygroundPage selected={selectedCharacter()} providerConfigured t={t as never} />);
  const input = screen.getByRole("textbox", { name: "trialMessage" });
  await user.type(input, "Activate the harbour lore");
  backend.previewCharacterPlayground.mockClear();
  await user.tab();
  expect(backend.previewCharacterPlayground).toHaveBeenCalledWith(expect.objectContaining({
    messages: expect.arrayContaining([expect.objectContaining({ role: "user", content: "Activate the harbour lore" })]),
  }));
});
