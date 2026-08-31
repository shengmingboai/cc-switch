import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { homeDir, join } from "@tauri-apps/api/path";
import { settingsApi, type AppId } from "@/lib/api";
import type { SettingsFormState } from "./useSettingsForm";

export type DirectoryAppId = Exclude<AppId, "claude-desktop">;
type AppDirectoryKey =
  | "claude"
  | "codex"
  | "grokbuild"
  | "opencode"
  | "pi";

export interface ResolvedDirectories {
  appConfig: string;
  claude: string;
  codex: string;
  grokbuild: string;
  opencode: string;
  pi: string;
}

// Single source of truth for per-app directory metadata.
const APP_DIRECTORY_META: Record<
  DirectoryAppId,
  { key: AppDirectoryKey; defaultFolder: string }
> = {
  claude: { key: "claude", defaultFolder: ".claude" },
  codex: { key: "codex", defaultFolder: ".codex" },
  grokbuild: { key: "grokbuild", defaultFolder: ".grok" },
  opencode: { key: "opencode", defaultFolder: ".config/opencode" },
  pi: { key: "pi", defaultFolder: ".pi/agent" },
};

const DIRECTORY_KEY_TO_SETTINGS_FIELD: Record<
  AppDirectoryKey,
  keyof SettingsFormState
> = {
  claude: "claudeConfigDir",
  codex: "codexConfigDir",
  grokbuild: "grokConfigDir",
  opencode: "opencodeConfigDir",
  pi: "piConfigDir",
};

const sanitizeDir = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const computeDefaultConfigDir = async (
  app: DirectoryAppId,
): Promise<string | undefined> => {
  try {
    const home = await homeDir();
    return await join(home, APP_DIRECTORY_META[app].defaultFolder);
  } catch (error) {
    console.error(
      "[useDirectorySettings] Failed to resolve default config dir",
      error,
    );
    return undefined;
  }
};

export interface UseDirectorySettingsProps {
  settings: SettingsFormState | null;
  onUpdateSettings: (updates: Partial<SettingsFormState>) => void;
}

export interface UseDirectorySettingsResult {
  resolvedDirs: ResolvedDirectories;
  isLoading: boolean;
  updateDirectory: (app: DirectoryAppId, value?: string) => void;
  browseDirectory: (app: DirectoryAppId) => Promise<void>;
  resetDirectory: (app: DirectoryAppId) => Promise<void>;
  resetAllDirectories: (overrides?: ResolvedAppDirectoryOverrides) => void;
}

export type ResolvedAppDirectoryOverrides = Partial<
  Record<AppDirectoryKey, string | undefined>
>;

/**
 * useDirectorySettings - 目录管理
 * 负责：
 * - resolvedDirs 状态
 * - 目录选择（browse）
 * - 目录重置
 * - 默认值计算
 */
export function useDirectorySettings({
  settings,
  onUpdateSettings,
}: UseDirectorySettingsProps): UseDirectorySettingsResult {
  const { t } = useTranslation();

  const [resolvedDirs, setResolvedDirs] = useState<ResolvedDirectories>({
    appConfig: "",
    claude: "",
    codex: "",
    grokbuild: "",
    opencode: "",
    pi: "",
  });
  const [isLoading, setIsLoading] = useState(true);

  const defaultsRef = useRef<ResolvedDirectories>({
    appConfig: "",
    claude: "",
    codex: "",
    grokbuild: "",
    opencode: "",
    pi: "",
  });

  // 加载目录信息
  useEffect(() => {
    let active = true;
    setIsLoading(true);

    const load = async () => {
      try {
        const [
          overrideRaw,
          claudeDir,
          codexDir,
          grokDir,
          opencodeDir,
          piDir,
          defaultClaudeDir,
          defaultCodexDir,
          defaultGrokDir,
          defaultOpencodeDir,
          defaultPiDir,
        ] = await Promise.all([
          settingsApi.getAppConfigDirOverride(),
          settingsApi.getConfigDir("claude"),
          settingsApi.getConfigDir("codex"),
          settingsApi.getConfigDir("grokbuild"),
          settingsApi.getConfigDir("opencode"),
          settingsApi.getConfigDir("pi"),
          computeDefaultConfigDir("claude"),
          computeDefaultConfigDir("codex"),
          computeDefaultConfigDir("grokbuild"),
          computeDefaultConfigDir("opencode"),
          computeDefaultConfigDir("pi"),
        ]);

        if (!active) return;

        const fixedAppConfigDir = sanitizeDir(overrideRaw ?? undefined) ?? "";

        defaultsRef.current = {
          appConfig: fixedAppConfigDir,
          claude: defaultClaudeDir ?? "",
          codex: defaultCodexDir ?? "",
          grokbuild: defaultGrokDir ?? "",
          opencode: defaultOpencodeDir ?? "",
          pi: defaultPiDir ?? "",
        };

        setResolvedDirs({
          appConfig: fixedAppConfigDir,
          claude: claudeDir || defaultsRef.current.claude,
          codex: codexDir || defaultsRef.current.codex,
          grokbuild: grokDir || defaultsRef.current.grokbuild,
          opencode: opencodeDir || defaultsRef.current.opencode,
          pi: piDir || defaultsRef.current.pi,
        });
      } catch (error) {
        console.error(
          "[useDirectorySettings] Failed to load directory info",
          error,
        );
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const updateDirectoryState = useCallback(
    (key: AppDirectoryKey, value?: string) => {
      const sanitized = sanitizeDir(value);
      onUpdateSettings({
        [DIRECTORY_KEY_TO_SETTINGS_FIELD[key]]: sanitized,
      });

      setResolvedDirs((prev) => {
        const next = sanitized ?? defaultsRef.current[key];
        // Same-ref early-return: unchanged value shouldn't cascade renders
        // through the settings tree.
        if (prev[key] === next) return prev;
        return { ...prev, [key]: next };
      });
    },
    [onUpdateSettings],
  );

  const updateDirectory = useCallback(
    (app: DirectoryAppId, value?: string) => {
      updateDirectoryState(APP_DIRECTORY_META[app].key, value);
    },
    [updateDirectoryState],
  );

  const browseDirectory = useCallback(
    async (app: DirectoryAppId) => {
      const key = APP_DIRECTORY_META[app].key;
      const settingsField = DIRECTORY_KEY_TO_SETTINGS_FIELD[key];
      const currentValue =
        (settings?.[settingsField] as string | undefined) ?? resolvedDirs[key];

      try {
        const picked = await settingsApi.selectConfigDirectory(currentValue);
        const sanitized = sanitizeDir(picked ?? undefined);
        if (!sanitized) return;
        updateDirectoryState(key, sanitized);
      } catch (error) {
        console.error("[useDirectorySettings] Failed to pick directory", error);
        toast.error(
          t("settings.selectFileFailed", {
            defaultValue: "选择目录失败",
          }),
        );
      }
    },
    [settings, resolvedDirs, t, updateDirectoryState],
  );

  const resetDirectory = useCallback(
    async (app: DirectoryAppId) => {
      const key = APP_DIRECTORY_META[app].key;
      if (!defaultsRef.current[key]) {
        const fallback = await computeDefaultConfigDir(app);
        if (fallback) {
          defaultsRef.current = {
            ...defaultsRef.current,
            [key]: fallback,
          };
        }
      }
      updateDirectoryState(key, undefined);
    },
    [updateDirectoryState],
  );

  const resetAllDirectories = useCallback(
    (overrides?: ResolvedAppDirectoryOverrides) => {
      setResolvedDirs({
        appConfig: defaultsRef.current.appConfig,
        claude: overrides?.claude ?? defaultsRef.current.claude,
        codex: overrides?.codex ?? defaultsRef.current.codex,
        grokbuild: overrides?.grokbuild ?? defaultsRef.current.grokbuild,
        opencode: overrides?.opencode ?? defaultsRef.current.opencode,
        pi: overrides?.pi ?? defaultsRef.current.pi,
      });
    },
    [],
  );

  return {
    resolvedDirs,
    isLoading,
    updateDirectory,
    browseDirectory,
    resetDirectory,
    resetAllDirectories,
  };
}
