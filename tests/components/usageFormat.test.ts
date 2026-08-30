import { describe, expect, it } from "vitest";
import {
  formatTokensShort,
  getLocaleFromLanguage,
} from "@/components/usage/format";

describe("usage format helpers", () => {
  it("formats every Chinese locale alias with simplified Chinese units", () => {
    expect(formatTokensShort(12_345, "zh-TW")).toBe("1.2 万");
    expect(formatTokensShort(123_456_789, "zh-Hant", 2)).toBe("1.23 亿");
  });

  it("resolves removed locales to a supported locale", () => {
    expect(getLocaleFromLanguage("zh_TW")).toBe("zh-CN");
    expect(getLocaleFromLanguage("zh-HK")).toBe("zh-CN");
    expect(getLocaleFromLanguage("ja-JP")).toBe("en-US");
  });
});
