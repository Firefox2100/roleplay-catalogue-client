export type Locale = "en-GB" | "zh-CN";
export type AppearanceMode = "light" | "dark" | "system";
export type ResourceLanguage = "en-uk" | "zh-cn";
export type ProviderKind = "openai" | "anthropic" | "ollama" | "openai-compatible";
export interface AppConfig { locale: Locale; appearance: AppearanceMode; llm: { provider: ProviderKind; baseUrl: string; apiKey: string; model: string; contextWindow: number; maxOutputTokens: number; temperature: number }; catalogue: { baseUrl: string; apiKey: string } }
export interface BootstrapData { version: string; config: AppConfig }

export type ResourceVisibility = "private" | "authenticated" | "public";
export interface ResourceMetadata { name: string; description: string; language: ResourceLanguage; visibility: ResourceVisibility; tags: string[] }
export interface CatalogueResource { id: string; resourceType: string; authorId: string; metadata: ResourceMetadata; draftDataId: string | null; coverImageResourceId: string | null; createdAt: string; updatedAt: string; authorUsername: string }
export interface ResourceList { items: CatalogueResource[]; nextOffset: number | null }
export interface CoverImage { mediaType: string; data: string }
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export interface CharacterRegexScript {
  id: string | number;
  scriptName: string;
  findRegex: string;
  replaceString: string;
  trimStrings: string[];
  placement: number[];
  disabled: boolean;
  markdownOnly: boolean;
  promptOnly: boolean;
  runOnEdit: boolean;
  substituteRegex: number | boolean;
  minDepth: number | null;
  maxDepth: number | null;
  [key: string]: JsonValue;
}
export interface CharacterScriptButton {
  enabled: boolean;
  buttons: Array<Record<string, JsonValue>>;
  [key: string]: JsonValue;
}
export interface CharacterScript {
  type: string;
  enabled: boolean;
  name: string;
  id: string | number;
  content: string;
  info: string;
  button: CharacterScriptButton;
  data: Record<string, JsonValue>;
  [key: string]: JsonValue;
}
export interface TavernHelperExtension {
  scripts: CharacterScript[];
  variables: Record<string, JsonValue>;
  [key: string]: JsonValue;
}
export interface CharacterCardV3Extensions {
  regex_scripts: CharacterRegexScript[];
  tavern_helper: TavernHelperExtension | null;
  [key: string]: JsonValue;
}
export interface CharacterCardV3Data {
  name: string;
  nickname: string | null;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  group_only_greetings: string[];
  character_book: LorebookData | null;
  tags: string[];
  creator: string;
  character_version: string;
  extensions: CharacterCardV3Extensions;
}
export interface CharacterDraft { id: string; resourceId: string; resourceVersionId: string | null; createdAt: string; updatedAt: string; data: CharacterCardV3Data }
export interface SelectedCharacter { resource: CatalogueResource; draft: CharacterDraft | null }
export type LorebookPosition = "before_char" | "after_char";
export interface LorebookEntry {
  keys: string[];
  content: string;
  extensions: Record<string, JsonValue>;
  enabled: boolean;
  insertion_order: number;
  use_regex: boolean;
  constant: boolean;
  case_sensitive?: boolean | null;
  name?: string | null;
  priority?: number | null;
  id?: number | string | null;
  comment?: string | null;
  selective?: boolean | null;
  secondary_keys?: string[] | null;
  position?: LorebookPosition | null;
}
export interface LorebookData {
  name?: string | null;
  description?: string | null;
  scan_depth?: number | null;
  token_budget?: number | null;
  recursive_scanning?: boolean | null;
  extensions: Record<string, JsonValue>;
  entries: LorebookEntry[];
}
export interface LorebookDraft { id: string; resourceId: string; resourceVersionId: string | null; createdAt: string; updatedAt: string; data: LorebookData }
export interface SelectedLorebook { resource: CatalogueResource; draft: LorebookDraft | null }
export type SelectedResource = SelectedCharacter | SelectedLorebook;
export interface WorldOverview {
  resourceId: string;
  castMode: "fixed-single" | "fixed-ensemble" | "dynamic-ensemble";
  tags: string[];
  summary: string;
  tone: string;
  themes: string;
  coreRules: string;
  society: string;
  technologyAndMagic: string;
  history: string;
  conflicts: string;
  userRole: string;
  intendedExperience: string;
  constraints: string;
  updatedAt: string;
}
export interface CreateCharacterInput { name: string; description: string; language: ResourceLanguage; visibility: ResourceVisibility; tags: string[] }
export interface CreateResourceInput extends CreateCharacterInput { resourceType: "sillytavern/character" | "sillytavern/lorebook" }
export interface EditorContext { path: string | null; selectedText: string | null; cursor: number | null }
export interface AiProposal { id: string; path: string; value: JsonValue; rationale: string }
export interface AiMessage { id: string; conversationId: string; role: "user" | "assistant"; content: string; proposals: AiProposal[]; createdAt: string }
export interface AiConversation { id: string; resourceId: string | null; title: string; createdAt: string; updatedAt: string; messages: AiMessage[] }
export interface SendAiMessageInput { conversationId: string | null; resourceId: string | null; resourceLanguage: ResourceLanguage; message: string; draft: CharacterCardV3Data | null; worldOverview: WorldOverview | null; selection: EditorContext | null }
