import "./preload";

import { OpenAI_NS } from "./tyeps";
import { support_models, app } from "./constants";
import { RequestPreProcess } from "./RequestChecker";
import { GenerateReply } from "./GenerateReply";
import { SchemasNS } from "./schemas";
import { FastifyReply } from "fastify";

const corsHandler = async function handler(request: any, reply: FastifyReply) {
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header("Access-Control-Allow-Methods", "*");
  reply.header("Access-Control-Allow-Headers", "*");
  reply.header("Access-Control-Max-Age", "86400");
  reply.send();
};

const main = async () => {
  // https://platform.openai.com/docs/api-reference/chat/create
  app.post<{
    Body: OpenAI_NS.CompletionRequest;
  }>(
    "/v1/chat/completions",
    {
      schema: {
        body: SchemasNS.ChatCompletionsBody,
      },
    },
    async function handler(request, reply) {
      const checker = new RequestPreProcess(request.body, request, reply);
      if (!(await checker.check_headers())) {
        return;
      }
      const payload = await checker.check();
      if (!payload) {
        return;
      }

      const generator = new GenerateReply(payload, request, reply);
      return await generator.run();
    }
  );

  app.options("/v1/chat/completions", corsHandler);

  // https://platform.openai.com/docs/api-reference/models/list
  app.get("/v1/models", async function handler(request, reply) {
    return {
      object: "list",
      data: [
        ...support_models.map((id) => ({
          id,
          object: "model",
          created: 1625730000,
          owned_by: "default",
        })),
      ],
    };
  });
  app.options("/v1/models", corsHandler);

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
