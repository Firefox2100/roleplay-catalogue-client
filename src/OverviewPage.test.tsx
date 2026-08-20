import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { OverviewPage } from "./OverviewPage";
import { characterData, selectedCharacter } from "./test/fixtures";

const backend = vi.hoisted(() => ({
  listResourceVersions: vi.fn().mockResolvedValue([]),
  previewResourceDraft: vi.fn(),
  exportResourceDraft: vi.fn(),
  publishResource: vi.fn(),
}));
vi.mock("./backend", () => backend);
const t = (key: string) => key;

beforeEach(() => backend.listResourceVersions.mockResolvedValue([]));

it("blocks preview, export, and publishing while the draft has unsaved edits", () => {
  render(<OverviewPage selected={selectedCharacter()} conflict={null} dirty context={{ path: null, selectedText: null, cursor: null }} onContext={vi.fn()} onNavigate={vi.fn()} onChangeResource={vi.fn()} onRetryConflict={vi.fn()} onUseServerDraft={vi.fn()} t={t as never} />);
  expect(screen.getByRole("button", { name: "previewMerged" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "exportDraft" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "publishRelease" })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("unsavedReleaseBlock");
});

it("opens the relevant editor and assistant context from a diagnostic", async () => {
  const user = userEvent.setup();
  const onContext = vi.fn();
  const onNavigate = vi.fn();
  render(<OverviewPage selected={selectedCharacter(characterData({ name: "" }))} conflict={null} dirty={false} context={{ path: null, selectedText: null, cursor: null }} onContext={onContext} onNavigate={onNavigate} onChangeResource={vi.fn()} onRetryConflict={vi.fn()} onUseServerDraft={vi.fn()} t={t as never} />);
  await user.click(screen.getAllByRole("button", { name: /requiredFieldEmpty/ })[0]);
  expect(onContext).toHaveBeenCalledWith({ path: "name", selectedText: null, cursor: null });
  expect(onNavigate).toHaveBeenCalledWith("foundation");
});

it("blocks publishing when a linked lorebook still points at its draft", () => {
  render(<OverviewPage selected={selectedCharacter(characterData(), { linkedLorebooks: [{ resourceId: "lore-1", versionId: null }] })} conflict={null} dirty={false} context={{ path: null, selectedText: null, cursor: null }} onContext={vi.fn()} onNavigate={vi.fn()} onChangeResource={vi.fn()} onRetryConflict={vi.fn()} onUseServerDraft={vi.fn()} t={t as never} />);
  expect(screen.getByRole("button", { name: "publishRelease" })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("draftLinksBlockPublish");
});
