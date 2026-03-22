import { useState, useEffect, useCallback } from "react";

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

interface UseProviderInstructionsReturn {
  data: ProviderInstructions | null;
  originalData: ProviderInstructions | null;
  isLoading: boolean;
  error: string | null;
  updateInstruction: (provider: string, mode: string, text: string) => void;
  updateRepeatEveryPrompt: (provider: string, mode: string, value: boolean) => void;
  saveInstruction: (provider: string, mode: string) => Promise<void>;
  resetInstruction: (provider: string, mode: string) => Promise<void>;
  resetAllInstructions: () => Promise<void>;
}

export function useProviderInstructions(): UseProviderInstructionsReturn {
  const [data, setData] = useState<ProviderInstructions | null>(null);
  const [originalData, setOriginalData] = useState<ProviderInstructions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/settings/provider-instructions");
        if (!response.ok) {
          throw new Error("Failed to fetch provider instructions");
        }
        const instructions: ProviderInstructions = await response.json();
        setData(instructions);
        setOriginalData(instructions);
        setError(null);
      } catch (err) {
        console.error("Error fetching provider instructions:", err);
        setError("Failed to load provider instructions");
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const updateInstruction = useCallback((provider: string, mode: string, text: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const newData = { ...prev };
      if (provider === "openai" || provider === "zai") {
        newData[provider] = { ...prev[provider] };
        if (mode === "plan" || mode === "build") {
          newData[provider][mode] = {
            ...prev[provider][mode],
            instruction: text,
          };
        }
      }
      return newData;
    });
  }, []);

  const updateRepeatEveryPrompt = useCallback((provider: string, mode: string, value: boolean) => {
    setData((prev) => {
      if (!prev) return prev;
      const newData = { ...prev };
      if (provider === "openai" || provider === "zai") {
        newData[provider] = { ...prev[provider] };
        if (mode === "plan" || mode === "build") {
          newData[provider][mode] = {
            ...prev[provider][mode],
            repeatEveryPrompt: value,
          };
        }
      }
      return newData;
    });
  }, []);

  const saveInstruction = useCallback(async (provider: string, mode: string) => {
    try {
      const providerData = data?.[provider as keyof ProviderInstructions];
      const currentConfig = providerData?.[mode as keyof typeof providerData];
      
      if (!currentConfig) {
        throw new Error("Provider instruction config not found");
      }

      const response = await fetch("/api/settings/provider-instructions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          mode,
          instruction: currentConfig.instruction,
          repeatEveryPrompt: currentConfig.repeatEveryPrompt,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save provider instruction");
      }

      setOriginalData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [provider]: {
            ...prev[provider as keyof ProviderInstructions],
            [mode]: { ...currentConfig },
          },
        };
      });

      setError(null);
    } catch (err) {
      console.error("Error saving provider instruction:", err);
      setError("Failed to save provider instruction");
      throw err;
    }
  }, [data]);

  const resetInstruction = useCallback(async (provider: string, mode: string) => {
    try {
      const response = await fetch(
        `/api/settings/provider-instructions?provider=${provider}&mode=${mode}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to reset provider instruction");
      }

      const resetValue = { instruction: null, repeatEveryPrompt: true };
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [provider]: {
            ...prev[provider as keyof ProviderInstructions],
            [mode]: resetValue,
          },
        };
      });
      setOriginalData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [provider]: {
            ...prev[provider as keyof ProviderInstructions],
            [mode]: resetValue,
          },
        };
      });
      setError(null);
    } catch (err) {
      console.error("Error resetting provider instruction:", err);
      setError("Failed to reset provider instruction");
    }
  }, []);

  const resetAllInstructions = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/settings/provider-instructions?resetAll=true",
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to reset all provider instructions");
      }

      setData((prev) => {
        if (!prev) return prev;
        return {
          openai: { plan: { instruction: null, repeatEveryPrompt: true }, build: { instruction: null, repeatEveryPrompt: true } },
          zai: { plan: { instruction: null, repeatEveryPrompt: true }, build: { instruction: null, repeatEveryPrompt: true } },
        };
      });
      setError(null);
    } catch (err) {
      console.error("Error resetting all provider instructions:", err);
      setError("Failed to reset all provider instructions");
    }
  }, []);

  return {
    data,
    originalData,
    isLoading,
    error,
    updateInstruction,
    updateRepeatEveryPrompt,
    saveInstruction,
    resetInstruction,
    resetAllInstructions,
  };
}
