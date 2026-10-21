import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollaborationPanel } from "./CollaborationPanel";
import { resource } from "./test/fixtures";

const addResourceCoAuthor = vi.fn();
const removeResourceCoAuthor = vi.fn();
vi.mock("./backend", () => ({
  addResourceCoAuthor: (...args: unknown[]) => addResourceCoAuthor(...args),
  removeResourceCoAuthor: (...args: unknown[]) => removeResourceCoAuthor(...args),
}));

const t = (key: string) => key;

describe("CollaborationPanel", () => {
  beforeEach(() => { addResourceCoAuthor.mockReset(); removeResourceCoAuthor.mockReset(); });

  it("lets the owner add a co-author by username", async () => {
    const base = resource();
    const updated = { ...base, revision: base.revision + 1, coAuthorIds: ["editor-id"], coAuthorUsernames: ["editor"] };
    addResourceCoAuthor.mockResolvedValue(updated);
    const onResource = vi.fn();
    render(<CollaborationPanel resource={base} currentUser={{ id: base.authorId, username: "owner" }} onResource={onResource} onLeave={vi.fn()} t={t} />);
    await userEvent.type(screen.getByLabelText("coAuthorUsername"), "editor");
    await userEvent.click(screen.getByRole("button", { name: "addCoAuthor" }));
    expect(addResourceCoAuthor).toHaveBeenCalledWith(base.id, "editor");
    expect(onResource).toHaveBeenCalledWith(updated);
  });

  it("lets a co-author remove their own access", async () => {
    const base = resource();
    const shared = { ...base, coAuthorIds: ["editor-id"], coAuthorUsernames: ["editor"] };
    removeResourceCoAuthor.mockResolvedValue({ ...base, coAuthorIds: [], coAuthorUsernames: [] });
    const onLeave = vi.fn();
    render(<CollaborationPanel resource={shared} currentUser={{ id: "editor-id", username: "editor" }} onResource={vi.fn()} onLeave={onLeave} t={t} />);
    await userEvent.click(screen.getByRole("button", { name: "leaveCollaboration" }));
    expect(removeResourceCoAuthor).toHaveBeenCalledWith(base.id, "editor-id");
    expect(onLeave).toHaveBeenCalledOnce();
  });
});
