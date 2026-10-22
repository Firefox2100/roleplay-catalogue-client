import { describe, expect, it } from "vitest";
import { isValidRegex, splitRegexLiteral } from "./regexLiteral";

describe("regex literal parsing", () => {
  it("splits at the final slash so escaped and nested content stays intact", () => {
    expect(splitRegexLiteral("/a\\/b.+/gi")).toEqual({ source: "a\\/b.+", flags: "gi" });
    expect(splitRegexLiteral("plain text")).toBeNull();
  });

  it("rejects malformed patterns and accepts plain and literal expressions", () => {
    expect(isValidRegex("hello\\s+world")).toBe(true);
    expect(isValidRegex("/[a-z]+/i")).toBe(true);
    expect(isValidRegex("/[a-/")).toBe(false);
    expect(isValidRegex("/value/ii")).toBe(false);
  });
});
