export interface ModelDefinition {
  id: string;
  name: string;
  apiModel: string;
  supportsReasoning: boolean;
  supportsStreaming: boolean;
  contextWindow: number;
  description: string;
}

export const OPENAI_MODELS: ModelDefinition[] = [
  {
    id: "gpt-5.4",
    name: "GPT 5.4",
    apiModel: "gpt-5.4",
    supportsReasoning: true,
    supportsStreaming: true,
    contextWindow: 128000,
    description: "Most capable GPT model",
  },
  {
    id: "gpt-5.3-codex",
    name: "GPT 5.3 Codex",
    apiModel: "gpt-5.3-codex",
    supportsReasoning: true,
    supportsStreaming: true,
    contextWindow: 200000,
    description: "Optimized for code generation and reasoning",
  },
];

export function getModelById(id: string): ModelDefinition | undefined {
  return OPENAI_MODELS.find((m) => m.id === id);
}

export function getDefaultModel(): ModelDefinition {
  return OPENAI_MODELS[0];
}
