import { describe, expect, it } from "vitest";
import { providerPresets } from "@/config/claudeProviderPresets";
import { claudeDesktopProviderPresets } from "@/config/claudeDesktopProviderPresets";
import { codexProviderPresets } from "@/config/codexProviderPresets";
import { grokBuildProviderPresets } from "@/config/grokBuildProviderPresets";
import { opencodeProviderPresets } from "@/config/opencodeProviderPresets";
import { piProviderPresets } from "@/config/piProviderPresets";

const REMOVED_PRESET_NAMES = new Set([
  "AiHubMix",
  "Amux",
  "Baidu Qianfan Coding Plan",
  "Baidu Qianfan Token Plan",
  "BaiLing",
  "Tencent Hunyuan",
]);

const ALL_PRESET_LISTS = [
  providerPresets,
  claudeDesktopProviderPresets,
  codexProviderPresets,
  grokBuildProviderPresets,
  opencodeProviderPresets,
  piProviderPresets,
];

describe("provider preset roster", () => {
  it("does not expose removed provider presets in any app", () => {
    for (const presets of ALL_PRESET_LISTS) {
      for (const preset of presets) {
        expect(REMOVED_PRESET_NAMES.has(preset.name), preset.name).toBe(false);
      }
    }
  });

  it("keeps the independently supported Bailian preset", () => {
    expect(providerPresets.some((preset) => preset.name === "Bailian")).toBe(
      true,
    );
    expect(
      codexProviderPresets.some((preset) => preset.name === "Bailian"),
    ).toBe(true);
    expect(
      opencodeProviderPresets.some((preset) => preset.name === "Bailian"),
    ).toBe(true);
  });
});
