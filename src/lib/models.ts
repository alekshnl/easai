export interface ModelDefinition {
  id: string;
  name: string;
  apiModel: string;
  provider: "openai" | "zai";
  supportsReasoning: boolean;
  supportsStreaming: boolean;
  contextWindow: number;
  description: string;
}

export const MODELS: ModelDefinition[] = [
  {
    id: "gpt-5.4",
    name: "GPT 5.4",
    apiModel: "gpt-5.4",
    provider: "openai",
    supportsReasoning: true,
    supportsStreaming: true,
    contextWindow: 128000,
    description: "Most capable GPT model",
  },
  {
    id: "gpt-5.3-codex",
    name: "GPT 5.3 Codex",
    apiModel: "gpt-5.3-codex",
    provider: "openai",
    supportsReasoning: true,
    supportsStreaming: true,
    contextWindow: 200000,
    description: "Optimized for code generation and reasoning",
  },
  {
    id: "glm-5",
    name: "GLM-5",
    apiModel: "glm-5",
    provider: "zai",
    supportsReasoning: false,
    supportsStreaming: true,
    contextWindow: 128000,
    description: "Z.AI GLM-5 model",
  },
  {
    id: "glm-5-turbo",
    name: "GLM-5 Turbo",
    apiModel: "glm-5-turbo",
    provider: "zai",
    supportsReasoning: false,
    supportsStreaming: true,
    contextWindow: 128000,
    description: "Z.AI GLM-5 Turbo (faster)",
  },
  {
    id: "glm-4.7",
    name: "GLM-4.7",
    apiModel: "glm-4.7",
    provider: "zai",
    supportsReasoning: false,
    supportsStreaming: true,
    contextWindow: 128000,
    description: "Z.AI GLM-4.7 model",
  },
];

export const OPENAI_MODELS = MODELS.filter((m) => m.provider === "openai");
export const ZAI_MODELS = MODELS.filter((m) => m.provider === "zai");

export function getModelById(id: string): ModelDefinition | undefined {
  return MODELS.find((m) => m.id === id);
}

export function getModelsForProvider(provider: string): ModelDefinition[] {
  return MODELS.filter((m) => m.provider === provider);
}

export function getDefaultModel(): ModelDefinition {
  return MODELS[0];
}
