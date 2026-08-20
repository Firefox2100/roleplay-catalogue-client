import { describe, expect, it } from "vitest";
import { threeWayMerge } from "./threeWayMerge";

describe("threeWayMerge", () => {
  it("combines independent local and server edits", () => {
    expect(threeWayMerge(
      { name: "Base", description: "Old", tags: ["one"] },
      { name: "Mine", description: "Old", tags: ["one"] },
      { name: "Base", description: "Theirs", tags: ["one"] },
    )).toEqual({ merged: { name: "Mine", description: "Theirs", tags: ["one"] }, conflicts: {} });
  });

  it("reports divergent changes and tentatively keeps the local value", () => {
    const result = threeWayMerge({ name: "Base" }, { name: "Mine" }, { name: "Theirs" });
    expect(result.merged.name).toBe("Mine");
    expect(result.conflicts.name).toEqual({ base: "Base", local: "Mine", remote: "Theirs" });
  });

  it("deeply compares arrays and objects", () => {
    expect(threeWayMerge(
      { settings: { enabled: true }, prompts: [{ id: "one" }] },
      { settings: { enabled: true }, prompts: [{ id: "one" }] },
      { settings: { enabled: true }, prompts: [{ id: "one" }] },
    ).conflicts).toEqual({});
  });

  it("preserves deletions while accepting a separate addition", () => {
    expect(threeWayMerge({ old: "x" }, {}, { old: "x", added: 1 })).toEqual({ merged: { old: undefined, added: 1 }, conflicts: {} });
  });
});
