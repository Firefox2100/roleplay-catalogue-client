import { afterEach, describe, expect, it, vi } from "vitest";
import { createUiId } from "./uiId";

describe("ephemeral UI identifiers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the platform UUID generator when it is available", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "platform-id" });
    expect(createUiId()).toBe("platform-id");
  });

  it("uses a monotonic fallback without relying on pseudorandom values", () => {
    vi.stubGlobal("crypto", {});
    const first = createUiId("entry");
    const second = createUiId("entry");
    expect(first).toMatch(/^entry-\d+-\d+$/);
    expect(second).not.toBe(first);
  });
});
