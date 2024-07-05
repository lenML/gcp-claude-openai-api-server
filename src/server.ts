import "./preload";

import Fastify from "fastify";

import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import { HttpsProxyAgent } from "https-proxy-agent";

const support_models = [
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

const claude_model_names_map = {
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
};

const client = new AnthropicVertex({
  accessToken: process.env.ACCESS_TOKEN,
  projectId: process.env.ANTHROPIC_VERTEX_PROJECT_ID,
  region: process.env.CLOUD_ML_REGION ?? "us-east5",
  httpAgent: process.env.HTTPS_PROXY
    ? new HttpsProxyAgent(process.env.HTTPS_PROXY)
    : undefined,
});

// 简单的进行一下校验，如果不设置 private_key，那么就不校验
const private_key = process.env.PRIVATE_KEY ?? "";

// 对于第一个 message 的处理方式，可以是 remove 或者 添加 "continue"
const ensure_first_mode = process.env.ENSURE_FIRST_MODE ?? "remove";

const app = Fastify({
  logger: true,
});

const created = Math.ceil(new Date().getTime() / 1000);
const system_fingerprint = Math.random().toString(36).substring(2, 15);

const claude_stop_to_openai_stop = (cl_stop: string) => {
  return (
    {
      max_tokens: "length",
      end_turn: "stop",
      stop_sequence: "content_filter",
      tool_use: "tool_calls",
    }[cl_stop] ?? cl_stop
  );
};

const main = async () => {
  // https://platform.openai.com/docs/api-reference/chat/create
  app.post<{
    Body: {
      messages: { role: "user" | "system" | "assistant"; content: string }[];
      model: string;
      max_tokens?: number;
      frequency_penalty?: number;
      presence_penalty?: number;
      response_format?: { type: "json_object" };
      seed?: number;
      stop?: string | string[];
      stream?: boolean;
      stream_options?: {
        include_usage?: boolean;
      };
      temperature?: number;
      top_p?: number;
      n?: number;
      tools?: Array<{
        type: string;
        function: {
          name: string;
          parameters?: any;
          description?: string;
        };
      }>;
      tool_choice?: any;
      parallel_tool_calls?: any;
      user?: string;
    };
  }>("/v1/chat/completions", async function handler(request, reply) {
    if (private_key) {
      const { headers } = request;
      const { authorization } = headers;
      if (!authorization) {
        throw new Error("Authorization header is required");
      }
      const [scheme, token] = authorization.split(" ");
      if (scheme !== "Bearer") {
        throw new Error("Authorization scheme must be Bearer");
      }
      if (token !== private_key) {
        throw new Error("Invalid API key");
      }
    }

    const {
      messages,
      model: _model,
      max_tokens = 512,
      temperature = 0.75,
      top_p = 1,
      stop,
      stream = false,
      // 下面的都不支持...
      n = 1,
      presence_penalty = 0,
      frequency_penalty = 0,
    } = request.body;

    // params checker
    if (!Array.isArray(messages)) {
      throw new Error("messages should be an array");
    }
    const model = claude_model_names_map[_model] ?? _model;
    if (!support_models.includes(model)) {
      throw new Error(`model ${model} is not supported`);
    }

    // 因为 claude 的 system 需要单独设置，所以从 messages 中提取出来
    // NOTE: 所以也就是说，只支持一个 system
    const system0 = messages.find((m) => m.role === "system");
    const no_sys_messages = messages.filter((m) => m.role !== "system") as {
      role: "user" | "assistant";
      content: string;
    }[];
    if (no_sys_messages[0].role !== "user") {
      // ensure first message is 'user' role
      switch (ensure_first_mode) {
        case "remove": {
          while (no_sys_messages[0].role !== ("user" as any)) {
            no_sys_messages.shift();
          }
          break;
        }
        case "continue": {
          no_sys_messages.unshift({
            role: "user",
            content: "continue",
          });
          break;
        }
        default: {
          console.warn(
            `ensure_first_mode ${ensure_first_mode} is not supported, use 'remove' instead`
          );
        }
      }
    }
    if (no_sys_messages.length === 0) {
      throw new Error("messages should contain at least one user message");
    }
    const created = Math.ceil(new Date().getTime() / 1000);

    const create_params = {
      system: system0?.content,
      messages: no_sys_messages,
      model,
      max_tokens,
      temperature,
      top_p,
      stop_sequences: !stop ? undefined : Array.isArray(stop) ? stop : [stop],
    };

    if (!stream) {
      const result = await client.messages.create({
        ...create_params,
        stream: false,
      });
      const openai_response = {
        id: result.id,
        object: "chat.completion",
        created,
        model: result.model,
        system_fingerprint: system_fingerprint,
        choices: [
          ...result.content.map((x: any, index) => ({
            index,
            message: {
              role: "assistant",
              // NOTE: 这里的 x 有可能是 tool_use，但是我们不支持 tools 所以都是 text
              content: x.text ?? "",
            },
            logprobs: null,
            finish_reason: claude_stop_to_openai_stop(
              result.stop_reason ?? "stop"
            ),
          })),
        ],
        usage: {
          prompt_tokens: result.usage.input_tokens,
          completion_tokens: result.usage.output_tokens,
          total_tokens: result.usage.input_tokens + result.usage.output_tokens,
        },
      };

      return openai_response;
    } else {
      const stream_id = Math.random().toString(36).substring(2, 15);
      async function* build_streaming() {
        const message_stream = await client.messages.create({
          ...create_params,
          stream: true,
        });
        let input_tokens = 0;
        let current_id = stream_id;
        let current_model = model;
        for await (const data of message_stream) {
          if (request.socket.closed) {
            message_stream.controller.abort();
            break;
          }
          switch (data.type) {
            case "message_start": {
              const { content, id, model } = data.message;
              current_id = id;
              current_model = model;
              yield {
                id,
                object: "chat.completion.chunk",
                created,
                model,
                system_fingerprint,
                choices: [
                  {
                    index: 0,
                    delta: {
                      role: "assistant",
                      content: "",
                    },
                    logprobs: null,
                    finish_reason: null,
                  },
                ],
              };
              input_tokens = data.message.usage.input_tokens;
              break;
            }
            case "message_stop": {
              // 这个最后会触发，但是用不到
              break;
            }
            case "message_delta": {
              // 这个会在 stop 之前触发，带有 stop_reason
              yield {
                id: current_id,
                object: "chat.completion.chunk",
                created,
                model,
                system_fingerprint,
                choices: [
                  {
                    index: 0,
                    delta: {
                      content: "",
                      role: "assistant",
                    },
                    logprobs: null,
                    finish_reason: data.delta.stop_reason
                      ? claude_stop_to_openai_stop(data.delta.stop_reason)
                      : null,
                  },
                ],
                usage: {
                  prompt_tokens: input_tokens,
                  completion_tokens: data.usage.output_tokens,
                  total_tokens: input_tokens + data.usage.output_tokens,
                },
              };
              break;
            }
            case "content_block_delta":
              {
                // 这个才是真正的 delta。。。
                const block = data.delta;
                if (block.type !== "text_delta") {
                  // 直接无视
                  break;
                }
                yield {
                  id: current_id,
                  object: "chat.completion.chunk",
                  created,
                  model: current_model,
                  system_fingerprint,
                  choices: [
                    {
                      index: 0,
                      delta: {
                        role: "assistant",
                        content: block.text,
                      },
                      logprobs: null,
                      finish_reason: null,
                    },
                  ],
                };
              }
              break;
          }
        }
      }

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Transfer-Encoding": "chunked",
      });
      // reply.raw.write("\n\n");

      try {
        for await (const data of build_streaming()) {
          // console.log(data);
          reply.raw.write("data: " + JSON.stringify(data));
          reply.raw.write("\n\n");
        }
      } catch (error) {
        console.error(error);
        console.error(JSON.stringify(error));
        throw error;
      }

      reply.raw.write("data: [DONE]");
      reply.raw.write("\n\n");

      reply.raw.end();
    }
  });

  app.options("/v1/chat/completions", async function handler(request, reply) {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "*");
    reply.header("Access-Control-Allow-Headers", "*");
    reply.header("Access-Control-Max-Age", "86400");
    reply.send();
  });

  // https://platform.openai.com/docs/api-reference/models/list
  app.get("/v1/models", async function handler(request, reply) {
    return {
      object: "list",
      data: [
        ...support_models.map((id) => ({
          id,
          object: "model",
          created,
          owned_by: "default",
        })),
      ],
    };
  });
  app.options("/v1/models", async function handler(request, reply) {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "*");
    reply.header("Access-Control-Allow-Headers", "*");
    reply.header("Access-Control-Max-Age", "86400");
    reply.send();
  });

  try {
    const port = process.env.PORT ?? 3565;
    const host = process.env.HOST ?? "0.0.0.0";
    await app.listen({ port: Number(port), host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

main().then(console.error);
