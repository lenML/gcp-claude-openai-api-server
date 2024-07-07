import { FastifyReply, FastifyRequest } from "fastify";
import { CreatePayload, OpenAI_NS } from "./tyeps";
import {
  private_key,
  claude_model_names_map,
  support_models,
  ensure_first_mode,
} from "./constants";

export class RequestPreProcess {
  constructor(
    public payload: OpenAI_NS.CompletionRequest,
    public request: FastifyRequest<{
      Body: OpenAI_NS.CompletionRequest;
    }>,
    public reply: FastifyReply
  ) {}

  async check_headers() {
    const { request, reply } = this;
    if (private_key) {
      const { headers } = request;
      const { authorization } = headers;
      if (!authorization) {
        await reply
          .code(401)
          .header("WWW-Authenticate", "Bearer realm='openai'")
          .send({
            message: "Authorization header is required",
            code: "no_auth",
          });
        return false;
      }
      const [scheme, token] = authorization.split(" ");
      if (scheme !== "Bearer") {
        await reply
          .code(401)
          .header("WWW-Authenticate", "Bearer realm='openai'")
          .send({
            message: "Authorization scheme must be Bearer",
            code: "invalid_scheme",
          });
        return false;
      }
      if (token !== private_key) {
        await reply
          .code(403)
          .send({ message: "Invalid API key", code: "invalid_api_key" });
        return false;
      }
    }
    return true;
  }

  async check(): Promise<Required<CreatePayload> | null> {
    const { payload, reply } = this;
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
    } = payload;

    const model = claude_model_names_map[_model] ?? _model;
    if (!support_models.includes(model)) {
      await reply.code(400).send({
        message: `model ${model} is not supported`,
        code: "model_not_supported",
      });
      return null;
    }

    if (!Array.isArray(messages)) {
      throw new Error("messages should be an array");
    }

    const ensure_result = await this.ensure_first_message_is_user();
    if (!ensure_result) {
      return null;
    }
    const { system0, no_sys_messages } = ensure_result;

    return {
      created: Math.ceil(new Date().getTime() / 1000),
      system: system0?.content,
      messages: no_sys_messages,
      model,
      max_tokens,
      temperature,
      top_p,
      stop_sequences: !stop ? undefined : Array.isArray(stop) ? stop : [stop],
    };
  }

  async ensure_first_message_is_user() {
    const { reply } = this;
    const { messages } = this.payload;

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
          // NOTE: if the first message is not user, remove it until the first user message
          while (no_sys_messages[0].role !== ("user" as any)) {
            no_sys_messages.shift();
          }
          break;
        }
        case "continue": {
          // NOTE: if the first message is not user, add a user message `continue`
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
      await reply.code(400).send({
        message: "messages should contain at least one user message",
        code: "messages_empty",
      });
      return null;
    }

    return {
      system0,
      no_sys_messages,
    };
  }
}
