import { describe, expect, it } from "vitest";
import type { WorldBundleData } from "./types";
import { translate } from "./i18n";
import { reviewWorld, worldCompleteness, worldConfigLabel, worldSectionLabel, WORLD_CONFIGS, WORLD_SECTIONS } from "./WorldBundlePage";

const bundle = (): WorldBundleData => ({
  spec: "wse_world", specVersion: "1.0",
  world: { id: "world-1", name: "Harbour", description: "A living port.", starting_time: "2026-01-01T00:00:00Z", language: "en", metadata: { tags: [] } },
  author: null,
  sections: Object.fromEntries(WORLD_SECTIONS.map((name) => [name, []])),
  configs: Object.fromEntries(WORLD_CONFIGS.map((name) => [name, []])),
  prompts: [], workflows: [], media: [],
});

describe("WorldSE review", () => {
  it("measures required fields without treating optional collections as incomplete", () => {
    expect(worldCompleteness(bundle())).toEqual({ filled: 6, total: 6, percent: 100 });
    const value = bundle();
    value.world.name = "";
    value.world.starting_time = "";
    expect(worldCompleteness(value)).toEqual({ filled: 4, total: 6, percent: 67 });
  });
  it("accepts a minimal canonical v1.0 bundle", () => expect(reviewWorld(bundle())).toEqual([]));
  it("finds duplicate graph identifiers and invalid root state", () => {
    const value = bundle();
    value.world.starting_time = "not a date";
    value.sections.characters = [{ id: "same", name: "One", description: "" }, { id: "same", name: "Two", description: "Two" }];
    expect(reviewWorld(value).map((item) => item.message)).toEqual(expect.arrayContaining(["Starting time is not a valid date and time.", "Duplicate graph ID: same", "Characters row 1 has an empty description."]));
  });
  it("localises WorldSE navigation and review findings into natural Chinese", () => {
    const t = (key: Parameters<typeof translate>[1]) => translate("zh-CN", key);
    expect(worldSectionLabel(t, "background_characters")).toBe("背景角色");
    expect(worldConfigLabel(t, "embed")).toBe("嵌入模型分配");
    const value = bundle();
    value.world.starting_time = "not a date";
    value.sections.characters = [{ id: "same", description: "" }, { id: "same", description: "ok" }];
    expect(reviewWorld(value, t).map((item) => item.message)).toEqual(expect.arrayContaining(["模拟起始时间不是有效的日期时间。", "图谱 ID 重复：same", "“主要角色”中的第 1 条记录没有填写描述。"]));
  });
  it("finds dangling graph references and mutually exclusive placement", () => {
    const value = bundle();
    value.sections.locations = [{ id: "dock", name: "Dock", description: "A dock" }];
    value.sections.item_stacks = [{ id: "stack", item_id: "missing-item", location_id: "dock", holder_id: "missing-holder" }];
    expect(reviewWorld(value).map((item) => item.message)).toEqual(expect.arrayContaining([
      "Unknown Item Id reference: missing-item",
      "Unknown Holder Id reference: missing-holder",
      "Item Stacks cannot have both a location and a holder.",
    ]));
  });

  it("enforces WSE relationship invariants", () => {
    const value = bundle();
    value.sections.characters = [{ id: "hero", name: "Hero", description: "Hero" }];
    value.sections.entity_relationships = [{ id: "rel", source: { type: "character", id: "hero" }, target: { type: "character", id: "hero" }, visibility: "private", perspective_character_id: null }];
    expect(reviewWorld(value).map((item) => item.message)).toEqual(expect.arrayContaining([
      "Relationship source and target must be different.",
      "Private relationships require a perspective character.",
    ]));
  });
});
