import { describe, expect, it } from "vitest";
import { cardStatistics, estimateTokens, reviewCard } from "./OverviewPage";
import { characterData } from "./test/fixtures";

const t = (key: string) => key;

describe("card overview analysis", () => {
  it("estimates Latin and CJK text without requiring a provider tokenizer", () => {
    expect(estimateTokens("hello world")).toBe(3);
    expect(estimateTokens("你好世界")).toBe(5);
    expect(estimateTokens("   ")).toBe(0);
  });

  it("counts fields, lore types, scripts, and alternate openings", () => {
    const stats = cardStatistics(characterData({
      alternate_greetings: ["One"],
      character_book: { extensions: {}, entries: [{ keys: ["station"], content: "Lore", extensions: {}, enabled: true, insertion_order: 1, use_regex: false, constant: false, type: "location" } as never] },
      extensions: { regex_scripts: [{ id: 1, scriptName: "Clean", findRegex: "x", replaceString: "y", trimStrings: [], placement: [], disabled: false, markdownOnly: false, promptOnly: false, runOnEdit: false, substituteRegex: false, minDepth: null, maxDepth: null }], tavern_helper: { scripts: [], variables: {} } },
    }));
    expect(stats.alternateCount).toBe(1);
    expect(stats.entries).toHaveLength(1);
    expect(stats.typeCounts.get("location")).toBe(1);
    expect(stats.regexCount).toBe(1);
    expect(stats.totalTokens).toBeGreaterThan(0);
  });

  it("finds release-blocking content errors and actionable warnings", () => {
    const issues = reviewCard(characterData({
      name: "", first_mes: "", tags: [], alternate_greetings: [""], mes_example: "No boundary",
      character_book: { token_budget: 1, extensions: {}, entries: [
        { keys: ["["], secondary_keys: [], content: "", extensions: {}, enabled: true, insertion_order: 1, use_regex: true, constant: false, selective: true },
      ] },
      assets: [{ type: "", uri: "", name: "", ext: "" }],
    }), t as never);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: "error", path: "name" }),
      expect.objectContaining({ severity: "error", path: "first_mes" }),
      expect.objectContaining({ title: "invalidRegexKey" }),
      expect.objectContaining({ title: "missingCardTags" }),
      expect.objectContaining({ title: "assetFieldEmpty" }),
    ]));
  });
});
