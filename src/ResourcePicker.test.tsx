import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ResourcePicker } from "./ResourcePicker";
import { resource, selectedPreset } from "./test/fixtures";

const backend = vi.hoisted(() => ({
  listOwnedResources: vi.fn(),
  selectResource: vi.fn(),
  createResource: vi.fn(),
  fetchCharacterCover: vi.fn(),
}));
vi.mock("./backend", () => backend);
const t = (key: string) => key;

it("allows settings access before a catalogue is configured", async () => {
  const user = userEvent.setup();
  const onOpenSettings = vi.fn();
  render(<ResourcePicker configured={false} selected={null} locale="en-GB" onSelected={vi.fn()} onOpenSettings={onOpenSettings} t={t as never} />);
  await user.click(screen.getByRole("button", { name: "openSettings" }));
  expect(onOpenSettings).toHaveBeenCalledOnce();
  expect(backend.listOwnedResources).not.toHaveBeenCalled();
});

it("refetches by resource type and selects the returned preset", async () => {
  const user = userEvent.setup();
  const presetResource = resource({ resourceType: "sillytavern/preset", metadata: { name: "Creative", description: "Preset description", language: "en-uk", visibility: "private", tags: [] } });
  backend.listOwnedResources.mockImplementation(async (type: string) => ({ items: type === "sillytavern/preset" ? [presetResource] : [], nextOffset: null }));
  backend.selectResource.mockResolvedValue(selectedPreset());
  const onSelected = vi.fn();
  render(<ResourcePicker configured selected={null} locale="en-GB" onSelected={onSelected} onOpenSettings={vi.fn()} t={t as never} />);

  await user.click(screen.getByRole("button", { name: "presets" }));
  expect(await screen.findByText("Creative")).toBeInTheDocument();
  expect(backend.listOwnedResources).toHaveBeenLastCalledWith("sillytavern/preset");
  await user.click(screen.getByRole("button", { name: "select" }));
  await waitFor(() => expect(onSelected).toHaveBeenCalledOnce());
  expect(backend.selectResource).toHaveBeenCalledWith("resource-1", "sillytavern/preset");
});
