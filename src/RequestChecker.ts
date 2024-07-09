import { FastifyReply, FastifyRequest } from "fastify";
import { CreatePayload, OpenAI_NS } from "./tyeps";
import {
  private_key,
  claude_model_names_map,
  support_models,
  ensure_first_mode,
  prompt_merge_mode,
  system_merge_mode,
  max_token_length,
} from "./constants";
import { PromptMerger } from "./PromptMerger";

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
    if (temperature < 0 || temperature > 1) {
      await reply.code(400).send({
        message: "temperature should be between 0 and 1",
        code: "invalid_temperature",
      });
      return null;
    }
    if (top_p < 0 || top_p > 1) {
      await reply.code(400).send({
        message: "top_p should be between 0 and 1",
        code: "invalid_top_p",
      });
      return null;
    }
    if (max_tokens < 1) {
      await reply.code(400).send({
        message: "max_tokens should be greater than 0",
        code: "invalid_max_tokens",
      });
      return null;
    }
    // claude api limit
    if (max_tokens > 4096) {
      await reply.code(400).send({
        message: "max_tokens should be less than 4096",
        code: "invalid_max_tokens",
      });
      return null;
    }

    if (!Array.isArray(messages)) {
      throw new Error("messages should be an array");
    }

    const { system_prompt, messages: merged_messages } =
      this.process_messages();
    const ensure_messages = await this.ensure_first_message_is_user(
      merged_messages
    );
    if (!ensure_messages) {
      return null;
    }

    return {
      created: Math.ceil(new Date().getTime() / 1000),
      system: system_prompt || undefined,
      messages: ensure_messages,
      model,
      max_tokens,
      temperature,
      top_p,
      stop_sequences: !stop ? undefined : Array.isArray(stop) ? stop : [stop],
    };
  }

  private process_messages() {
    const { messages } = this.payload;
    const merger = new PromptMerger(messages, {
      prompt_merge_mode: prompt_merge_mode as any,
      system_merge_mode: system_merge_mode as any,
      max_token_length: max_token_length,
    });
    return merger.merge();
  }

  async ensure_first_message_is_user(
    messages: OpenAI_NS.CompletionRequest["messages"]
  ) {
    const { reply } = this;

    if (messages[0].role !== "user") {
      // ensure first message is 'user' role
      switch (ensure_first_mode) {
        case "remove": {
          // NOTE: if the first message is not user, remove it until the first user message
          while (messages[0].role !== ("user" as any)) {
            messages.shift();
          }
          break;
        }
        case "continue": {
          // NOTE: if the first message is not user, add a user message `continue`
          messages.unshift({
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
    if (messages.length === 0) {
      await reply.code(400).send({
        message: "messages should contain at least one user message",
        code: "messages_empty",
      });
      return null;
    }

    return messages.filter((x) => x.role !== "system") as {
      role: "user" | "assistant";
      content: string;
    }[];
  }
}
