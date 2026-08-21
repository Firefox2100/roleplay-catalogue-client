import { describe, expect, it } from "vitest";
import type { WorldBundleData } from "./types";
import { reviewWorld, WORLD_CONFIGS, WORLD_SECTIONS } from "./WorldBundlePage";

const bundle = (): WorldBundleData => ({
  spec: "wse_world", specVersion: "1.0",
  world: { id: "world-1", name: "Harbour", description: "A living port.", starting_time: "2026-01-01T00:00:00Z", language: "en", metadata: { tags: [] } },
  author: null,
  sections: Object.fromEntries(WORLD_SECTIONS.map((name) => [name, []])),
  configs: Object.fromEntries(WORLD_CONFIGS.map((name) => [name, []])),
  prompts: [], workflows: [], media: [],
});

describe("WorldSE review", () => {
  it("accepts a minimal canonical v1.0 bundle", () => expect(reviewWorld(bundle())).toEqual([]));
  it("finds duplicate graph identifiers and invalid root state", () => {
    const value = bundle();
    value.world.starting_time = "not a date";
    value.sections.characters = [{ id: "same", name: "One", description: "" }, { id: "same", name: "Two", description: "Two" }];
    expect(reviewWorld(value).map((item) => item.message)).toEqual(expect.arrayContaining(["Starting time is not a valid date and time.", "Duplicate graph ID: same", "Characters row 1 has an empty description."]));
  });
});
