import { Router } from "express";
import type { OpenAIModelList } from "../types/openai.js";

export const modelsRouter = Router();

// Model ID mapping to Claude SDK model names
export const MODEL_MAP: Record<string, string> = {
  "claude-opus-4-5": "opus",
  "claude-sonnet-4-5": "sonnet",
  "claude-haiku-4-5": "haiku",
  // Aliases
  "opus": "opus",
  "sonnet": "sonnet",
  "haiku": "haiku",
  "claude-opus": "opus",
  "claude-sonnet": "sonnet",
  "claude-haiku": "haiku",
};

const MODELS: OpenAIModelList = {
  object: "list",
  data: [
    {
      id: "claude-opus-4-5",
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: "anthropic",
    },
    {
      id: "claude-sonnet-4-5",
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: "anthropic",
    },
    {
      id: "claude-haiku-4-5",
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: "anthropic",
    },
  ],
};

modelsRouter.get("/models", (_req, res) => {
  res.json(MODELS);
});

modelsRouter.get("/models/:id", (req, res) => {
  const model = MODELS.data.find((m) => m.id === req.params.id);

  if (!model) {
    res.status(404).json({
      error: {
        message: `Model '${req.params.id}' not found`,
        type: "invalid_request_error",
        param: "model",
        code: "model_not_found",
      },
    });
    return;
  }

  res.json(model);
});
