import { describe, expect, it } from "vitest";
import { providerPresets } from "@/config/claudeProviderPresets";
import { claudeDesktopProviderPresets } from "@/config/claudeDesktopProviderPresets";
import { opencodeProviderPresets } from "@/config/opencodeProviderPresets";

// 千帆 Token Plan 个人版（2026-07-13 起替代 Coding Plan 发售；存量 Coding
// Plan 可用至到期，旧预设保留并存）。Codex 侧口径由 codexChatProviderPresets
// 与 codexReasoningLevelPresets 两个测试锁定，此处覆盖其余五应用。
const PRESET_NAME = "Baidu Qianfan Token Plan";
const OPENAI_BASE = "https://qianfan.baidubce.com/v2/tokenplan/personal";
const ANTHROPIC_BASE =
  "https://qianfan.baidubce.com/anthropic/tokenplan/personal";
// 阵容=Token Plan 主文档（2026-08-14 版）；ernie-5.1 官方标注 8/20 下线不收
const MODEL_IDS = [
  "deepseek-v4-pro",
  "deepseek-v4-flash",
  "deepseek-v4-flash-0731",
  "glm-5.2",
  "glm-5.1",
  "kimi-k2.6",
];

describe("Baidu Qianfan Token Plan presets", () => {
  it("Claude preset points every model role at deepseek-v4-pro", () => {
    const preset = providerPresets.find((item) => item.name === PRESET_NAME);
    expect(preset).toBeDefined();

    const env = (preset?.settingsConfig as { env: Record<string, string> }).env;
    expect(env.ANTHROPIC_BASE_URL).toBe(ANTHROPIC_BASE);
    // 官方 Claude Code 接入页（2026-07-30 版）全角色 deepseek-v4-pro
    for (const key of [
      "ANTHROPIC_MODEL",
      "ANTHROPIC_DEFAULT_HAIKU_MODEL",
      "ANTHROPIC_DEFAULT_SONNET_MODEL",
      "ANTHROPIC_DEFAULT_OPUS_MODEL",
    ]) {
      expect(env[key], key).toBe("deepseek-v4-pro");
    }
  });

  it("Claude Desktop preset proxies the Anthropic-compatible endpoint", () => {
    const preset = claudeDesktopProviderPresets.find(
      (item) => item.name === PRESET_NAME,
    );
    expect(preset).toBeDefined();
    expect(preset?.baseUrl).toBe(ANTHROPIC_BASE);
    expect(preset?.mode).toBe("proxy");
    expect(preset?.apiFormat).toBe("anthropic");
  });

  it("OpenCode preset carries the full Token Plan lineup", () => {
    const preset = opencodeProviderPresets.find(
      (item) => item.name === PRESET_NAME,
    );
    expect(preset).toBeDefined();
    expect(preset?.settingsConfig.npm).toBe("@ai-sdk/openai-compatible");
    expect(
      (preset?.settingsConfig.options as { baseURL: string }).baseURL,
    ).toBe(OPENAI_BASE);
    expect(Object.keys(preset?.settingsConfig.models ?? {})).toEqual(MODEL_IDS);
  });

});
