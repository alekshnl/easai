import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface ProviderInstructionConfig {
  instruction: string | null;
  repeatEveryPrompt: boolean;
}

export interface ProviderInstructions {
  openai: {
    plan: ProviderInstructionConfig;
    build: ProviderInstructionConfig;
  };
  zai: {
    plan: ProviderInstructionConfig;
    build: ProviderInstructionConfig;
  };
}

export type ProviderName = "openai" | "zai";
export type ModeName = "plan" | "build";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minuten

const instructionCache = new Map<
  string,
  { value: ProviderInstructionConfig; timestamp: number }
>();

function getCacheKey(provider: string, mode: string): string {
  return `${provider}_${mode}`;
}

function parseConfig(value: string | null): ProviderInstructionConfig {
  if (!value) {
    return { instruction: null, repeatEveryPrompt: true };
  }
  try {
    const parsed = JSON.parse(value);
    return {
      instruction: parsed.instruction || null,
      repeatEveryPrompt: parsed.repeatEveryPrompt !== false, // Default: true
    };
  } catch {
    return { instruction: null, repeatEveryPrompt: true };
  }
}

function serializeConfig(config: ProviderInstructionConfig): string {
  return JSON.stringify({
    instruction: config.instruction,
    repeatEveryPrompt: config.repeatEveryPrompt,
  });
}

export async function getAllProviderInstructions(): Promise<ProviderInstructions> {
  const providers: Array<"openai" | "zai"> = ["openai", "zai"];
  const modes: Array<"plan" | "build"> = ["plan", "build"];

  const result: Partial<ProviderInstructions> = {};

  for (const provider of providers) {
    result[provider] = {} as ProviderInstructions[typeof provider];
    for (const mode of modes) {
      result[provider]![mode] = await getProviderInstruction(provider, mode);
    }
  }

  return result as ProviderInstructions;
}

export async function getProviderInstruction(
  provider: string,
  mode: string
): Promise<ProviderInstructionConfig> {
  const cacheKey = getCacheKey(provider, mode);
  const cached = instructionCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }

  const [setting] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, `instructions_${provider}_${mode}`));

  const value = parseConfig(setting?.value || null);
  instructionCache.set(cacheKey, { value, timestamp: Date.now() });

  return value;
}

export async function updateProviderInstruction(
  provider: string,
  mode: string,
  instruction: string,
  repeatEveryPrompt: boolean
): Promise<void> {
  const key = `instructions_${provider}_${mode}`;
  const value = serializeConfig({ instruction, repeatEveryPrompt });

  const [existing] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key));

  if (existing) {
    await db.update(settings).set({ value }).where(eq(settings.key, key));
  } else {
    await db.insert(settings).values({ key, value });
  }

  const cacheKey = getCacheKey(provider, mode);
  instructionCache.set(cacheKey, {
    value: { instruction, repeatEveryPrompt },
    timestamp: Date.now(),
  });
}

export async function resetProviderInstruction(
  provider: string,
  mode: string
): Promise<void> {
  const key = `instructions_${provider}_${mode}`;
  await db.delete(settings).where(eq(settings.key, key));

  const cacheKey = getCacheKey(provider, mode);
  instructionCache.delete(cacheKey);
}

export async function resetAllProviderInstructions(): Promise<void> {
  const providers: Array<"openai" | "zai"> = ["openai", "zai"];
  const modes: Array<"plan" | "build"> = ["plan", "build"];

  for (const provider of providers) {
    for (const mode of modes) {
      await db
        .delete(settings)
        .where(eq(settings.key, `instructions_${provider}_${mode}`));
      instructionCache.delete(getCacheKey(provider, mode));
    }
  }
}

export function clearInstructionCache(): void {
  instructionCache.clear();
}
