import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import { fastify } from "fastify";
import { HttpsProxyAgent } from "https-proxy-agent";

export const support_models = [
  "claude-3-5-sonnet-v2@20241022",
  "claude-3-5-sonnet@20240620",
  "claude-3-opus@20240229",
  "claude-3-sonnet@20240229",
  "claude-3-haiku@20240307",
  // NOTE: 因为用的 @anthropic-ai/vertex-sdk 所以...不支持 gemini
  // TODO: 要支持的话可能需要改为 gcp-sdk
  //   "gemini-1.5-pro-001",
  //   "gemini-1.5-flash-001",
  //   "gemini-1.0-pro",
  //   "gemini-1.0-pro-vision",
];
export const claude_model_names_map = {
  "claude-3-5-sonnet-20241022": "claude-3-5-sonnet-v2@20241022",
  "claude-3-5-sonnet-20240620": "claude-3-5-sonnet@20240620",
  "claude-3-opus-20240229": "claude-3-opus@20240229",
  "claude-3-sonnet-20240229": "claude-3-sonnet@20240229",
  "claude-3-haiku-20240307": "claude-3-haiku@20240307",
  //   "gemini-1.5-pro": "gemini-1.5-pro-001",
  //   "gemini-1.5-flash": "gemini-1.5-flash-001",
  //   "gemini-pro-1.5": "gemini-1.5-pro-001",
  //   "gemini-flash-1.5": "gemini-1.5-flash-001",
  //   "gemini-pro": "gemini-1.0-pro",
  //   "gemini-pro-vision": "gemini-1.0-pro-vision",
} as Record<string, string>;
export const client = new AnthropicVertex({
  accessToken: process.env.ACCESS_TOKEN,
  projectId: process.env.ANTHROPIC_VERTEX_PROJECT_ID,
  region: process.env.CLOUD_ML_REGION ?? "us-east5",
  httpAgent: process.env.HTTPS_PROXY
    ? new HttpsProxyAgent(process.env.HTTPS_PROXY)
    : undefined,
});

console.log(
  `
=== setup info ===
access_token: ${client.accessToken?.slice(0, 5)}***
project_id: ${client.projectId?.slice(0, 5)}***
cloud_ml_region: ${client.region}
https_proxy: ${process.env.HTTPS_PROXY}
===
  `
);

// 简单的进行一下校验，如果不设置 private_key，那么就不校验
export const private_key = process.env.PRIVATE_KEY ?? "";
// 对于第一个 message 的处理方式，可以是 remove 或者 添加 "continue"
export const ensure_first_mode = process.env.ENSURE_FIRST_MODE ?? "remove";
export const prompt_merge_mode = process.env.PROMPT_MERGE_MODE ?? "only_system";
export const system_merge_mode =
  process.env.SYSTEM_MERGE_MODE ?? "merge_top_user";
export const max_token_length = parseInt(
  process.env.MAX_TOKEN_LENGTH ?? "4096"
);

export const app = fastify({
  logger: true,
});
export const system_fingerprint = Math.random().toString(36).substring(2, 15);
