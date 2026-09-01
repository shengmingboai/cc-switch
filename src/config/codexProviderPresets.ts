/**
 * Codex 预设供应商配置模板
 */
import { ProviderCategory } from "../types";
import type {
  CodexApiFormat,
  CodexCatalogModel,
  CodexChatReasoning,
  PromptCacheRoutingMode,
} from "../types";
import type { PresetTheme } from "./claudeProviderPresets";

export interface CodexProviderPreset {
  name: string;
  nameKey?: string; // i18n key for localized display name
  websiteUrl: string;
  // 第三方供应商可提供单独的获取 API Key 链接
  apiKeyUrl?: string;
  auth: Record<string, any>; // 将写入 ~/.codex/auth.json
  config: string; // 将写入 ~/.codex/config.toml（TOML 字符串）
  isOfficial?: boolean; // 标识是否为官方预设
  category?: ProviderCategory; // 新增：分类
  isCustomTemplate?: boolean; // 标识是否为自定义模板
  // 新增：请求地址候选列表（用于地址管理/测速）
  endpointCandidates?: string[];
  // 新增：视觉主题配置
  theme?: PresetTheme;
  // 图标配置
  icon?: string; // 图标名称
  iconColor?: string; // 图标颜色
  // Codex API 格式
  apiFormat?: CodexApiFormat;
  // 仅用于区分预设来源；ChatGPT/Codex 与 xAI/Grok 的认证流程彼此独立。
  providerType?: "codex_oauth" | "xai_oauth";
  // OAuth 预设：隐藏 API Key 输入，保存前要求已登录托管账号
  requiresOAuth?: boolean;
  // Codex Chat 本地路由模式下的模型目录
  modelCatalog?: CodexCatalogModel[];
  // Codex Responses -> Chat Completions reasoning capability defaults
  codexChatReasoning?: CodexChatReasoning;
  // Session-based prompt-cache routing override for Chat Completions upstreams
  promptCacheRouting?: PromptCacheRoutingMode;
}

/**
 * 生成第三方供应商的 auth.json
 */
export function generateThirdPartyAuth(apiKey: string): Record<string, any> {
  return {
    OPENAI_API_KEY: apiKey || "",
  };
}

/**
 * 生成第三方供应商的 config.toml
 */
export function generateThirdPartyConfig(
  providerName: string,
  baseUrl: string,
  modelName = "gpt-5.6-sol",
): string {
  const tomlString = (value: string) => JSON.stringify(value);

  return `model_provider = "custom"
model = ${tomlString(modelName)}
model_reasoning_effort = "high"
disable_response_storage = true

[model_providers.custom]
name = ${tomlString(providerName)}
base_url = ${tomlString(baseUrl)}
wire_api = "responses"
requires_openai_auth = true`;
}

function modelCatalog(
  models: Array<
    | string
    | {
        model: string;
        displayName?: string;
        contextWindow?: number;
        // Native Responses (direct) overrides for the generated
        // model-catalogs.json. Omitted input modalities are inferred by the
        // backend: confirmed text-only models stay text-only; everything else
        // defaults to text+image.
        supportsParallelToolCalls?: boolean;
        inputModalities?: string[];
        // Vendor's OFFICIAL base_instructions; omit to inherit the neutral
        // template default. Required by Codex, so the backend always emits one.
        baseInstructions?: string;
        // Reasoning efforts the vendor's endpoint actually accepts (subset of
        // none/minimal/low/medium/high/xhigh/max/ultra). Omit to keep the
        // template's conservative none/high default. Pre-filled from official
        // vendor docs; users can still edit per provider in the form.
        reasoningLevels?: string[];
        defaultReasoningLevel?: string;
      }
  >,
): CodexCatalogModel[] {
  return models.map((entry) =>
    typeof entry === "string"
      ? { model: entry }
      : {
          model: entry.model,
          displayName: entry.displayName,
          contextWindow: entry.contextWindow,
          supportsParallelToolCalls: entry.supportsParallelToolCalls,
          inputModalities: entry.inputModalities,
          baseInstructions: entry.baseInstructions,
          reasoningLevels: entry.reasoningLevels,
          defaultReasoningLevel: entry.defaultReasoningLevel,
        },
  );
}

export const codexProviderPresets: CodexProviderPreset[] = [
  {
    name: "OpenAI Official",
    websiteUrl: "https://chatgpt.com/codex",
    isOfficial: true,
    category: "official",
    providerType: "codex_oauth",
    auth: {},
    config: ``,
    theme: {
      icon: "codex",
      backgroundColor: "#1F2937", // gray-800
      textColor: "#FFFFFF",
    },
    icon: "openai",
    iconColor: "#00A67E",
  },
  {
    name: "Kimi",
    websiteUrl: "https://platform.kimi.com",
    apiKeyUrl: "https://platform.kimi.com/console/api-keys",
    auth: generateThirdPartyAuth(""),
    config: generateThirdPartyConfig(
      "kimi",
      "https://api.moonshot.cn/v1",
      "kimi-k2.7-code",
    ),
    endpointCandidates: ["https://api.moonshot.cn/v1"],
    apiFormat: "openai_chat",
    modelCatalog: modelCatalog([
      // 档位照抄官方参数文档（2026-08-15 盘点）：k2.7-code 始终思考、官方
      // 标注不支持 reasoning_effort → 单档 high（防止伪造差异档）；k3 不可关思考、
      // 顶层 reasoning_effort 三档官方默认 max——
      // 不声明 default：模板默认 medium ∉ 子集时后端回落最高档 = max，恰合
      // 官方默认。两模型都关不掉思考，none 一律不列
      {
        model: "kimi-k2.7-code",
        displayName: "Kimi K2.7 Code",
        contextWindow: 262144,
        reasoningLevels: ["high"],
      },
      {
        model: "kimi-k3",
        displayName: "Kimi K3",
        contextWindow: 1048576,
        reasoningLevels: ["low", "high", "max"],
      },
    ]),
    // supportsEffort:true（2026-08-15 盘点）：Kimi 官方 Codex 接入文档
    //（platform.kimi.com/docs/guide/codex-kimi.md，直接以 CC Switch 为例）
    // 要求「支持思考模式 开启 / 支持推理强度 开启」；k3 的 reasoning_effort
    // 是顶层字符串。effortValueMode 不声明=passthrough 原值透传（勿用
    // deepseek 模式，会把 low 压成 high）。注：官方参数页写 k3"不应传入
    // thinking"、与接入指南"思考模式开启"矛盾，现网无事故报告，按接入指南
    // 保持 thinking 注入；用户报 Kimi 400 时首查此处
    codexChatReasoning: {
      supportsThinking: true,
      supportsEffort: true,
      thinkingParam: "thinking",
      effortParam: "reasoning_effort",
      outputFormat: "reasoning_content",
    },
    category: "cn_official",
    icon: "kimi",
    iconColor: "#6366F1",
  },
  {
    name: "Kimi For Coding",
    websiteUrl: "https://www.kimi.com/code/",
    apiKeyUrl: "https://www.kimi.com/code/",
    auth: generateThirdPartyAuth(""),
    config: generateThirdPartyConfig(
      "kimi_coding",
      "https://api.kimi.com/coding/v1",
      "kimi-for-coding",
    ),
    endpointCandidates: ["https://api.kimi.com/coding/v1"],
    apiFormat: "openai_chat",
    promptCacheRouting: "enabled",
    modelCatalog: modelCatalog([
      // Kimi Code 官方模型表（2026-08-15 盘点）：kimi-for-coding(-highspeed)
      // =K2.7 Code、Thinking 恒 ON 无档位 → 单档 high；k3/k3-256k 三档官方
      // 默认 high（与开放平台的默认 max 不同，须显式 default 防后端回落到
      // 最高档 max）。none 不列——该网关关思考=静默路由到 K2.6（换模型换
      // 计费）。网关 effort 白名单 ultra/max/xhigh/high/medium/low/minimum/
      // light/none，未知值 400（Codex 的 minimal 不在内，档位子集已挡住
      // 选择器，用户自改档位需自担）
      {
        model: "kimi-for-coding",
        displayName: "Kimi For Coding",
        contextWindow: 262144,
        reasoningLevels: ["high"],
      },
      {
        model: "kimi-for-coding-highspeed",
        displayName: "Kimi For Coding HighSpeed",
        contextWindow: 262144,
        reasoningLevels: ["high"],
      },
      {
        model: "k3",
        displayName: "Kimi K3",
        contextWindow: 1048576,
        reasoningLevels: ["low", "high", "max"],
        defaultReasoningLevel: "high",
      },
      {
        model: "k3-256k",
        displayName: "Kimi K3 256K",
        contextWindow: 262144,
        reasoningLevels: ["low", "high", "max"],
        defaultReasoningLevel: "high",
      },
    ]),
    // 官方 Codex 接入文档（kimi.com/code/docs/third-party-tools/codex.html，
    // 以 CC Switch 为例）：「支持思考模式 开启（必须——关闭后 K3/K2.7 Code
    // 都会被路由到 K2.6）/ 支持思考等级 开启」。effortValueMode 不声明=
    // passthrough；网关自身对 effort 做归一映射（null→high、none→关思考）
    codexChatReasoning: {
      supportsThinking: true,
      supportsEffort: true,
      thinkingParam: "thinking",
      effortParam: "reasoning_effort",
      outputFormat: "reasoning_content",
    },
    category: "cn_official",
    icon: "kimi",
    iconColor: "#6366F1",
  },
  {
    name: "Azure OpenAI",
    websiteUrl:
      "https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/codex",
    category: "third_party",
    isOfficial: true,
    auth: generateThirdPartyAuth(""),
    config: `model_provider = "custom"
model = "gpt-5.6-sol"
model_reasoning_effort = "high"
disable_response_storage = true

[model_providers.custom]
name = "Azure OpenAI"
base_url = "https://YOUR_RESOURCE_NAME.openai.azure.com/openai"
env_key = "OPENAI_API_KEY"
query_params = { "api-version" = "2025-04-01-preview" }
wire_api = "responses"
requires_openai_auth = true`,
    endpointCandidates: ["https://YOUR_RESOURCE_NAME.openai.azure.com/openai"],
    theme: {
      icon: "codex",
      backgroundColor: "#0078D4",
      textColor: "#FFFFFF",
    },
    icon: "azure",
    iconColor: "#0078D4",
  },
  {
    name: "DeepSeek",
    websiteUrl: "https://platform.deepseek.com",
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    auth: generateThirdPartyAuth(""),
    config: generateThirdPartyConfig(
      "deepseek",
      "https://api.deepseek.com",
      "deepseek-v4-flash",
    ),
    endpointCandidates: ["https://api.deepseek.com"],
    // DeepSeek 官方 Codex 文档（api-docs.deepseek.com → agent_integrations/codex）：
    // deepseek-v4-flash 原生 Responses（wire_api=responses 对自家 base_url），无需路由接管转换。
    // 后端按 deepseek.com host 直接镜像官方 models.json（freeform apply_patch +
    // GPT-5 harness + low/high/max 思考档，需 codex >= 0.144.0），这里只保留行清单与展示名。
    // 档位照抄官方 catalog（low/high/max 默认 high，2026-08-15 复核 flash/pro
    // 逐字节一致）：per-row 值会覆盖官方镜像，DeepSeek 官方目录变更时须同步这里
    // （Jason 2026-08-15 拍板：表单可见性优先于快照过时风险，"未设置"误导性更大）
    apiFormat: "openai_responses",
    modelCatalog: modelCatalog([
      {
        model: "deepseek-v4-flash",
        displayName: "DeepSeek V4 Flash",
        contextWindow: 1048576,
        reasoningLevels: ["low", "high", "max"],
      },
      // pro 已于 2026-08 开通 Responses/Codex 集成（官方 catalog 条目与 flash 仅差 priority）
      {
        model: "deepseek-v4-pro",
        displayName: "DeepSeek V4 Pro",
        contextWindow: 1048576,
        reasoningLevels: ["low", "high", "max"],
      },
    ]),
    category: "cn_official",
    icon: "deepseek",
    iconColor: "#1E88E5",
  },
  {
    name: "Zhipu GLM",
    websiteUrl: "https://open.bigmodel.cn",
    apiKeyUrl: "https://www.bigmodel.cn/claude-code",
    auth: generateThirdPartyAuth(""),
    config: generateThirdPartyConfig(
      "zhipu_glm",
      "https://open.bigmodel.cn/api/coding/paas/v4",
      "glm-5.2",
    ),
    endpointCandidates: ["https://open.bigmodel.cn/api/coding/paas/v4"],
    apiFormat: "openai_chat",
    modelCatalog: modelCatalog([
      // Chat 路由 supportsEffort:false：档位值不进 wire，none=注入
      // thinking:{type:"disabled"} 关思考，其余档一律等价于开思考。只暴露真实
      // 两态；不填的话 gpt5_5 模板默认 low/medium/high/xhigh 全是假差异档，
      // 且没有 none，用户在 Codex 里反而关不掉思考
      {
        model: "glm-5.2",
        displayName: "GLM-5.2",
        contextWindow: 200000,
        reasoningLevels: ["none", "high"],
      },
    ]),
    codexChatReasoning: {
      supportsThinking: true,
      supportsEffort: false,
      thinkingParam: "thinking",
      effortParam: "none",
      outputFormat: "reasoning_content",
    },
    category: "cn_official",
    icon: "zhipu",
    iconColor: "#0F62FE",
  },
  {
    name: "Zhipu GLM en",
    websiteUrl: "https://z.ai",
    apiKeyUrl: "https://z.ai/subscribe",
    auth: generateThirdPartyAuth(""),
    config: generateThirdPartyConfig(
      "zhipu_glm_en",
      "https://api.z.ai/api/coding/paas/v4",
      "glm-5.2",
    ),
    endpointCandidates: ["https://api.z.ai/api/coding/paas/v4"],
    apiFormat: "openai_chat",
    modelCatalog: modelCatalog([
      // Chat 路由 supportsEffort:false：档位值不进 wire，none=注入
      // thinking:{type:"disabled"} 关思考，其余档一律等价于开思考。只暴露真实
      // 两态；不填的话 gpt5_5 模板默认 low/medium/high/xhigh 全是假差异档，
      // 且没有 none，用户在 Codex 里反而关不掉思考
      {
        model: "glm-5.2",
        displayName: "GLM-5.2",
        contextWindow: 200000,
        reasoningLevels: ["none", "high"],
      },
    ]),
    codexChatReasoning: {
      supportsThinking: true,
      supportsEffort: false,
      thinkingParam: "thinking",
      effortParam: "none",
      outputFormat: "reasoning_content",
    },
    category: "cn_official",
    icon: "zhipu",
    iconColor: "#0F62FE",
  },
  {
    name: "Bailian",
    websiteUrl: "https://bailian.console.aliyun.com",
    apiKeyUrl: "https://bailian.console.aliyun.com/#/api-key",
    auth: generateThirdPartyAuth(""),
    config: generateThirdPartyConfig(
      "bailian",
      "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "qwen3-coder-plus",
    ),
    endpointCandidates: ["https://dashscope.aliyuncs.com/compatible-mode/v1"],
    // 阿里百炼 DashScope 原生支持 OpenAI Responses API（/compatible-mode/v1/responses，同一 base_url），无需路由接管转换
    apiFormat: "openai_responses",
    // 无官方 catalog：合成 MiMo 式（shell_command 编辑、不发 freeform apply_patch）
    modelCatalog: modelCatalog([
      {
        model: "qwen3-coder-plus",
        displayName: "Qwen3 Coder Plus",
        contextWindow: 1048576,
      },
    ]),
    category: "cn_official",
    icon: "bailian",
    iconColor: "#624AFF",
  },
  {
    name: "MiniMax",
    websiteUrl: "https://platform.minimaxi.com",
    apiKeyUrl: "https://platform.minimaxi.com/subscribe/coding-plan",
    auth: generateThirdPartyAuth(""),
    config: generateThirdPartyConfig(
      "minimax",
      "https://api.minimaxi.com/v1",
      "MiniMax-M3",
    ),
    endpointCandidates: ["https://api.minimaxi.com/v1"],
    // MiniMax 官方 API 参考已列 /v1/responses 为正式端点（CN/intl 双区，POST /v1/responses），原生 Responses，无需路由接管转换
    apiFormat: "openai_responses",
    // 官方 Codex catalog（platform.minimaxi.com/docs/token-plan/codex-cli）：
    // shell_command 编辑、并行工具、文本+图像，不声明 freeform apply_patch。
    // 档位照抄官方 catalog：none/high（M3 的 effort 是思考开关，minimal/low/medium
    // 端点接受但与 high 行为完全等价，不给假差异档）。与模板默认一致故 Codex 侧
    // 零行为变化，显式声明只为表单可见（"未设置"误导性更大，Jason 2026-08-15 拍板）
    modelCatalog: modelCatalog([
      {
        model: "MiniMax-M3",
        displayName: "MiniMax-M3",
        contextWindow: 1000000,
        reasoningLevels: ["none", "high"],
        supportsParallelToolCalls: true,
        inputModalities: ["text", "image"],
        baseInstructions:
          "You are Codex, a coding agent based on MiniMax-M3. You and the user share the same workspace and collaborate to achieve the user's goals.",
      },
    ]),
    category: "cn_official",
    icon: "minimax",
    iconColor: "#FF6B6B",
  },
  {
    name: "MiniMax en",
    websiteUrl: "https://platform.minimax.io",
    apiKeyUrl: "https://platform.minimax.io/subscribe/coding-plan",
    auth: generateThirdPartyAuth(""),
    config: generateThirdPartyConfig(
      "minimax_en",
      "https://api.minimax.io/v1",
      "MiniMax-M3",
    ),
    endpointCandidates: ["https://api.minimax.io/v1"],
    // MiniMax 官方 API 参考已列 /v1/responses 为正式端点（CN/intl 双区，POST /v1/responses），原生 Responses，无需路由接管转换
    apiFormat: "openai_responses",
    // 官方 Codex catalog（platform.minimax.io/docs/token-plan/codex）：
    // shell_command 编辑、并行工具、文本+图像，不声明 freeform apply_patch。
    // 档位照抄官方 catalog：none/high（M3 的 effort 是思考开关，minimal/low/medium
    // 端点接受但与 high 行为完全等价，不给假差异档）。与模板默认一致故 Codex 侧
    // 零行为变化，显式声明只为表单可见（"未设置"误导性更大，Jason 2026-08-15 拍板）
    modelCatalog: modelCatalog([
      {
        model: "MiniMax-M3",
        displayName: "MiniMax-M3",
        contextWindow: 1000000,
        reasoningLevels: ["none", "high"],
        supportsParallelToolCalls: true,
        inputModalities: ["text", "image"],
        baseInstructions:
          "You are Codex, a coding agent based on MiniMax-M3. You and the user share the same workspace and collaborate to achieve the user's goals.",
      },
    ]),
    category: "cn_official",
    icon: "minimax",
    iconColor: "#FF6B6B",
  },
  {
    name: "Xiaomi MiMo",
    websiteUrl: "https://platform.xiaomimimo.com",
    apiKeyUrl: "https://platform.xiaomimimo.com/#/console/api-keys",
    auth: generateThirdPartyAuth(""),
    config: generateThirdPartyConfig(
      "xiaomi_mimo",
      "https://api.xiaomimimo.com/v1",
      "mimo-v2.5-pro",
    ),
    endpointCandidates: ["https://api.xiaomimimo.com/v1"],
    // 小米 MiMo 官方 Codex 文档已声明原生支持 Responses API（wire_api=responses 对自家 base_url），无需路由接管转换
    apiFormat: "openai_responses",
    // 官方 Codex catalog（mimo.mi.com/.../codex-configuration）：
    // shell_command 编辑、不声明 freeform apply_patch。
    // 档位照抄官方 catalog：none/high（端点另收 low/medium 但官方自述三档
    // "效果一致，暂不区分推理强度"，不给假差异档）。与模板默认一致故 Codex 侧
    // 零行为变化，显式声明只为表单可见（"未设置"误导性更大，Jason 2026-08-15 拍板）
    modelCatalog: modelCatalog([
      {
        model: "mimo-v2.5-pro",
        displayName: "MiMo V2.5 Pro",
        contextWindow: 1048576,
        inputModalities: ["text"],
        reasoningLevels: ["none", "high"],
        baseInstructions:
          "You are MiMo, an AI assistant developed by Xiaomi. Today's date: {date} {week}. Your knowledge cutoff date is December 2024.",
      },
      {
        model: "mimo-v2.5",
        displayName: "MiMo V2.5",
        contextWindow: 1048576,
        inputModalities: ["text", "image"],
        reasoningLevels: ["none", "high"],
        baseInstructions:
          "You are MiMo, an AI assistant developed by Xiaomi. Today's date: {date} {week}. Your knowledge cutoff date is December 2024.",
      },
    ]),
    category: "cn_official",
    icon: "xiaomimimo",
    iconColor: "#000000",
  },
  {
    name: "Xiaomi MiMo Token Plan (China)",
    websiteUrl: "https://platform.xiaomimimo.com/#/token-plan",
    apiKeyUrl: "https://platform.xiaomimimo.com/#/console/plan-manage",
    auth: generateThirdPartyAuth(""),
    config: generateThirdPartyConfig(
      "xiaomi_mimo_token_plan",
      "https://token-plan-cn.xiaomimimo.com/v1",
      "mimo-v2.5-pro",
    ),
    endpointCandidates: ["https://token-plan-cn.xiaomimimo.com/v1"],
    // 小米 MiMo 官方 Codex 文档已声明原生支持 Responses API（wire_api=responses 对自家 base_url），无需路由接管转换
    apiFormat: "openai_responses",
    // 官方 Codex catalog（mimo.mi.com/.../codex-configuration）：
    // shell_command 编辑、不声明 freeform apply_patch。
    // 档位照抄官方 catalog：none/high（端点另收 low/medium 但官方自述三档
    // "效果一致，暂不区分推理强度"，不给假差异档）。与模板默认一致故 Codex 侧
    // 零行为变化，显式声明只为表单可见（"未设置"误导性更大，Jason 2026-08-15 拍板）
    modelCatalog: modelCatalog([
      {
        model: "mimo-v2.5-pro",
        displayName: "MiMo V2.5 Pro",
        contextWindow: 1048576,
        inputModalities: ["text"],
        reasoningLevels: ["none", "high"],
        baseInstructions:
          "You are MiMo, an AI assistant developed by Xiaomi. Today's date: {date} {week}. Your knowledge cutoff date is December 2024.",
      },
      {
        model: "mimo-v2.5",
        displayName: "MiMo V2.5",
        contextWindow: 1048576,
        inputModalities: ["text", "image"],
        reasoningLevels: ["none", "high"],
        baseInstructions:
          "You are MiMo, an AI assistant developed by Xiaomi. Today's date: {date} {week}. Your knowledge cutoff date is December 2024.",
      },
    ]),
    category: "cn_official",
    icon: "xiaomimimo",
    iconColor: "#000000",
  },
  {
    name: "xAI (Grok)",
    websiteUrl: "https://x.ai/api",
    apiKeyUrl: "https://console.x.ai",
    auth: generateThirdPartyAuth(""),
    config: generateThirdPartyConfig("xai", "https://api.x.ai/v1", "grok-4.5"),
    endpointCandidates: ["https://api.x.ai/v1"],
    // xAI 官方以 /v1/responses 为一等端点（docs.x.ai api-reference）：Codex 硬依赖的
    // store:false / include=["reasoning.encrypted_content"] / reasoning effort 均支持，
    // 原生 Responses，无需路由接管转换
    apiFormat: "openai_responses",
    modelCatalog: modelCatalog([
      {
        model: "grok-4.5",
        displayName: "Grok 4.5",
        contextWindow: 500000,
        supportsParallelToolCalls: true,
        inputModalities: ["text", "image"],
        // xAI Reasoning guide（docs.x.ai，2026-08）模型级枚举 low/medium/high
        // 默认 high；"Reasoning cannot be disabled" 故无 none 档（模板默认的
        // none 对 grok-4.5 是无效选项）；xhigh 是 grok-4.6 起才有的档位。
        // ⚠️ docs.x.ai/developers/grok-4-5 页面实际渲染的是 grok-4.6 内容勿引
        reasoningLevels: ["low", "medium", "high"],
      },
    ]),
    category: "third_party",
    icon: "xai",
    iconColor: "#000000",
  },
  {
    name: "xAI (Grok) OAuth",
    websiteUrl: "https://x.ai/grok",
    auth: generateThirdPartyAuth(""),
    // 托管 OAuth：真实 token 由本地代理按请求注入，CodexAdapter 硬定向
    // api.x.ai；这里的 base_url / 空 auth 只是配置快照，转发时不生效。
    config: generateThirdPartyConfig("xai", "https://api.x.ai/v1", "grok-4.5"),
    apiFormat: "openai_responses",
    providerType: "xai_oauth",
    requiresOAuth: true,
    modelCatalog: modelCatalog([
      {
        model: "grok-4.5",
        displayName: "Grok 4.5",
        contextWindow: 500000,
        supportsParallelToolCalls: true,
        inputModalities: ["text", "image"],
        // xAI Reasoning guide（docs.x.ai，2026-08）模型级枚举 low/medium/high
        // 默认 high；"Reasoning cannot be disabled" 故无 none 档（模板默认的
        // none 对 grok-4.5 是无效选项）；xhigh 是 grok-4.6 起才有的档位。
        // ⚠️ docs.x.ai/developers/grok-4-5 页面实际渲染的是 grok-4.6 内容勿引
        reasoningLevels: ["low", "medium", "high"],
      },
    ]),
    category: "third_party",
    icon: "xai",
    iconColor: "#000000",
  },
  {
    name: "Nvidia",
    websiteUrl: "https://build.nvidia.com",
    apiKeyUrl: "https://build.nvidia.com/settings/api-keys",
    auth: generateThirdPartyAuth(""),
    config: generateThirdPartyConfig(
      "nvidia",
      "https://integrate.api.nvidia.com/v1",
      "moonshotai/kimi-k2.5",
    ),
    endpointCandidates: ["https://integrate.api.nvidia.com/v1"],
    apiFormat: "openai_chat",
    modelCatalog: modelCatalog([
      {
        model: "moonshotai/kimi-k2.5",
        displayName: "Kimi K2.5",
        contextWindow: 262144,
      },
    ]),
    // 假开关撤销（2026-08-15 盘点）：NIM 官方 OpenAPI（moonshotai-kimi-k2-5-infer）
    // 请求体 additionalProperties:false 且合法字段表无顶层 thinking——原
    // thinking:{type} 注入要么被吞要么直接被拒；真参数 chat_template_kwargs:
    // {thinking:bool} 不在 thinkingParam 值域内。⚠️整块保留、thinkingParam
    // 显式置 none：删块会让后端推断按模型名命中 kimi 分支、假开关原地复活
    codexChatReasoning: {
      supportsThinking: false,
      supportsEffort: false,
      thinkingParam: "none",
      effortParam: "none",
      outputFormat: "reasoning_content",
    },
    category: "aggregator",
    icon: "nvidia",
    iconColor: "#000000",
  },
  {
    name: "OpenCode Go",
    websiteUrl: "https://opencode.ai/go",
    apiKeyUrl: "https://opencode.ai/go",
    auth: generateThirdPartyAuth(""),
    config: generateThirdPartyConfig(
      "opencode_go",
      "https://opencode.ai/zen/go/v1",
      "glm-5.2",
    ),
    endpointCandidates: ["https://opencode.ai/zen/go/v1"],
    apiFormat: "openai_chat",
    // OpenCode Zen 网关：统一接受顶层 reasoning_effort（其自家客户端同款参数），
    // 但合法档位逐模型（见各条目 reasoningLevels，镜像 models.dev；opencode
    // 客户端同样严格按模型声明发值）——代理转换层按表钳制，未声明 effort 的
    // 模型（toggle 型如 glm-5.1）不发该字段。不发厂商原生 thinking 字段。
    codexChatReasoning: {
      supportsThinking: true,
      supportsEffort: true,
      thinkingParam: "none",
      effortParam: "reasoning_effort",
      effortValueMode: "zen",
      outputFormat: "reasoning_content",
    },
    modelCatalog: modelCatalog([
      {
        model: "glm-5.2",
        displayName: "GLM 5.2",
        contextWindow: 204800,
        reasoningLevels: ["high", "max"],
      },
      { model: "glm-5.1", displayName: "GLM 5.1", contextWindow: 204800 },
      {
        model: "kimi-k2.7-code",
        displayName: "Kimi K2.7 Code",
        contextWindow: 262144,
      },
      {
        model: "deepseek-v4-pro",
        displayName: "DeepSeek V4 Pro",
        contextWindow: 1048576,
        reasoningLevels: ["high", "max"],
      },
      {
        model: "deepseek-v4-flash",
        displayName: "DeepSeek V4 Flash",
        contextWindow: 1048576,
        reasoningLevels: ["low", "high", "max"],
      },
      {
        model: "mimo-v2.5-pro",
        displayName: "MiMo V2.5 Pro",
        contextWindow: 1048576,
      },
    ]),
    category: "third_party",
    icon: "opencode",
    iconColor: "#211E1E",
  },
  {
    name: "OpenRouter",
    websiteUrl: "https://openrouter.ai",
    apiKeyUrl: "https://openrouter.ai/keys",
    auth: generateThirdPartyAuth(""),
    config: generateThirdPartyConfig(
      "openrouter",
      "https://openrouter.ai/api/v1",
      "gpt-5.6-sol",
    ),
    category: "aggregator",
    icon: "openrouter",
    iconColor: "#6566F1",
  },
];
