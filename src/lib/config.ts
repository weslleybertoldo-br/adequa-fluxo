// Centralized config wrapping env vars with production fallbacks.
// Override em prod via Vercel env. Fallback mantem dev rodando sem setup.

const env = (key: string, fallback: string) => process.env[key] || fallback;

export const SLACK = {
  CHANNEL_ENXOVAL: env("SLACK_CHANNEL_ENXOVAL_ID", "C09CQRNEVLZ"),
  USER_BRUNO: env("SLACK_USER_BRUNO_ID", "U05AKADK9EY"),
  USER_WESLLEY: env("SLACK_USER_WESLLEY_ID", "U08DF2E4RLP"),
} as const;

export const PIPEFY_PHASE = {
  CONCLUDED: env("PIPEFY_CONCLUDED_PHASE_ID", "323315793"),
} as const;

export const PIPEFY_TAG = {
  COMPRAR_ENXOVAL: env("PIPEFY_TAG_COMPRAR_ENXOVAL", "310425316"),
  ENTREGAR_ENXOVAL: env("PIPEFY_TAG_ENTREGAR_ENXOVAL", "310938829"),
  VALIDAR_ENXOVAL: env("PIPEFY_TAG_VALIDAR_ENXOVAL", "310959732"),
  ITENS_PEQUENOS: env("PIPEFY_TAG_ITENS_PEQUENOS", "310938809"),
  ITENS_GRANDES: env("PIPEFY_TAG_ITENS_GRANDES", "310425321"),
  MANUT_PEQUENAS: env("PIPEFY_TAG_MANUT_PEQUENAS", "310938821"),
  MANUT_GRANDES: env("PIPEFY_TAG_MANUT_GRANDES", "310425328"),
} as const;
