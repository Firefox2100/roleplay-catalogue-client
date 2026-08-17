import { invoke } from "@tauri-apps/api/core";
import type { AppConfig, BootstrapData, CoverImage, CreateCharacterInput, ResourceList, SelectedCharacter } from "./types";
export const loadBootstrap = () => invoke<BootstrapData>("load_bootstrap");
export const saveConfiguration = (config: AppConfig) => invoke<AppConfig>("save_configuration", { config });
export const listOwnedCharacters = () => invoke<ResourceList>("list_owned_characters");
export const fetchCharacterCover = (resourceId: string) => invoke<CoverImage | null>("fetch_character_cover", { resourceId });
export const selectCharacter = (resourceId: string) => invoke<SelectedCharacter>("select_character", { resourceId });
export const createCharacter = (input: CreateCharacterInput) => invoke<SelectedCharacter>("create_character", { input });
