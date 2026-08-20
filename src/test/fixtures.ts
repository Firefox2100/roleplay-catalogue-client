import type { CatalogueResource, CharacterCardV3Data, SelectedCharacter, SelectedPreset } from "../types";

export const resource = (overrides: Partial<CatalogueResource> = {}): CatalogueResource => ({
  id: "resource-1",
  resourceType: "sillytavern/character",
  authorId: "author-1",
  coAuthorIds: [],
  metadata: { name: "Test resource", description: "A useful description", language: "en-uk", visibility: "private", tags: [] },
  draftDataId: "draft-1",
  coverImageResourceId: null,
  linkedLorebooks: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  authorUsername: "writer",
  revision: 1,
  ...overrides,
});

export const characterData = (overrides: Partial<CharacterCardV3Data> = {}): CharacterCardV3Data => ({
  name: "Ada",
  nickname: null,
  description: "An analytical explorer.",
  personality: "Curious and precise.",
  scenario: "A distant research station.",
  first_mes: "The airlock opens.",
  mes_example: "<START>\n{{char}}: Welcome.",
  creator_notes: "",
  system_prompt: "",
  post_history_instructions: "",
  alternate_greetings: [],
  group_only_greetings: [],
  character_book: null,
  tags: ["science fiction"],
  creator: "Writer",
  character_version: "1.0.0",
  extensions: { regex_scripts: [], tavern_helper: null },
  assets: [],
  ...overrides,
});

export const selectedCharacter = (data = characterData(), resourceOverrides: Partial<CatalogueResource> = {}): SelectedCharacter => ({
  resource: resource(resourceOverrides),
  draft: { id: "draft-1", resourceId: "resource-1", resourceVersionId: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", revision: 1, data },
});

export const selectedPreset = (): SelectedPreset => ({
  resource: resource({ resourceType: "sillytavern/preset", metadata: { name: "Balanced", description: "", language: "en-uk", visibility: "private", tags: [] } }),
  draft: {
    id: "draft-1", resourceId: "resource-1", resourceVersionId: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", revision: 1,
    data: {
      temperature: 0.8,
      prompts: [{ identifier: "main", name: "Main prompt", role: "system", marker: false, system_prompt: true, content: "Stay in character." }],
      prompt_order: [{ character_id: 100000, order: [{ identifier: "main", enabled: true }] }],
    },
  },
});
