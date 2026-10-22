import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import * as backend from "./backend";

describe("typed Tauri boundary", () => {
  beforeEach(() => invoke.mockClear());

  it("loads and saves non-secret application configuration through Rust", async () => {
    const config = { locale: "en-GB", appearance: "system" } as never;
    await backend.loadBootstrap();
    await backend.saveConfiguration(config);
    await backend.fetchCharacterCover("resource-1");
    await backend.fetchImageContent("image-1");
    expect(invoke.mock.calls).toEqual([
      ["load_bootstrap"],
      ["save_configuration", { config }],
      ["fetch_character_cover", { resourceId: "resource-1" }],
      ["fetch_image_content", { imageResourceId: "image-1" }],
    ]);
  });

  it("maps catalogue operations to narrow commands and camelCase arguments", async () => {
    const metadata = { name: "Independent fixture", description: "", language: "en-uk", visibility: "private", tags: [] } as Parameters<typeof backend.saveResourceMetadata>[1];
    await backend.getCurrentUser();
    await backend.addResourceCoAuthor("resource-1", "writer");
    await backend.removeResourceCoAuthor("resource-1", "account-2");
    await backend.listOwnedResources("sillytavern/character");
    await backend.saveResourceMetadata("resource-1", metadata, 7);
    await backend.saveLinkedLorebooks("resource-1", [{ resourceId: "book-1", versionId: null }], 8);
    await backend.publishResource("resource-1", "1.0.0");
    await backend.transportLocalResource("resource-1");

    expect(invoke.mock.calls).toEqual([
      ["get_current_user"],
      ["add_resource_co_author", { resourceId: "resource-1", username: "writer" }],
      ["remove_resource_co_author", { resourceId: "resource-1", coAuthorId: "account-2" }],
      ["list_owned_resources", { resourceType: "sillytavern/character" }],
      ["save_resource_metadata", { resourceId: "resource-1", metadata, expectedRevision: 7 }],
      ["save_linked_lorebooks", { resourceId: "resource-1", linkedLorebooks: [{ resourceId: "book-1", versionId: null }], expectedRevision: 8 }],
      ["publish_resource", { resourceId: "resource-1", version: "1.0.0" }],
      ["transport_local_resource", { resourceId: "resource-1" }],
    ]);
  });

  it("keeps provider and local-editor payloads behind task-specific commands", async () => {
    const data = { name: "Independent fixture" } as never;
    const overview = { resourceId: "resource-1", castMode: "single", tags: [] } as never;
    await backend.saveLocalDraft("resource-1", data);
    await backend.saveCharacterDraft("resource-1", data, 3);
    await backend.importResourceFile("resource-1", "sillytavern/character", "local");
    await backend.listAiConversations("resource-1");
    await backend.deleteAiConversation("conversation-1");
    await backend.sendAiMessage({ message: "Revise this", resourceId: "resource-1" } as never);
    await backend.previewLorebookActivation(data, "activation text");
    await backend.loadWorldOverview("resource-1");
    await backend.saveWorldOverview(overview);

    expect(invoke.mock.calls.map(([command]) => command)).toEqual([
      "save_local_draft", "save_character_draft", "import_resource_file", "list_ai_conversations",
      "delete_ai_conversation", "send_ai_message", "preview_lorebook_activation", "load_world_overview", "save_world_overview",
    ]);
    expect(invoke).toHaveBeenCalledWith("import_resource_file", { resourceId: "resource-1", resourceType: "sillytavern/character", storageMode: "local" });
  });
});
