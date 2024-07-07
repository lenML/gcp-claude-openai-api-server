import { FastifyReply, FastifyRequest } from "fastify";
import { CreatePayload, OpenAI_NS } from "./tyeps";
import { client, system_fingerprint } from "./constants";
import { claude_stop_to_openai_stop } from "./utils";

export class GenerateReply {
  constructor(
    public payload: CreatePayload,
    public request: FastifyRequest<{
      Body: OpenAI_NS.CompletionRequest;
    }>,
    public reply: FastifyReply
  ) {}

  async request_stream_api() {
    const { request, reply, payload } = this;
    const { model, created } = payload;
    delete (payload as any).created;

    const stream_id = Math.random().toString(36).substring(2, 15);
    async function* build_streaming() {
      const message_stream = await client.messages.create({
        ...payload,
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

  async request_api() {
    const { request, reply, payload } = this;
    const { created, model } = payload;
    delete (payload as any).created;

    const result = await client.messages.create({
      ...payload,
      stream: false,
    });
    const openai_response = {
      id: result.id,
      object: "chat.completion",
      created: created,
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
  }

  async run() {
    const { request, reply } = this;
    try {
      if (request.body.stream) {
        return await this.request_stream_api();
      }
      return await this.request_api();
    } catch (error) {
      await reply.code(500).send({
        message:
          error instanceof Error ? error.message : "Internal Server Error",
        code: "internal_error",
      });
      return;
    }
  }
}
