export namespace SchemasNS {
  export const ChatCompletionsBody = {
    type: "object",
    required: ["messages", "model"],
    properties: {
      messages: {
        type: "array",
        items: {
          type: "object",
          required: ["role", "content"],
          properties: {
            role: {
              type: "string",
              enum: ["user", "system", "assistant"],
            },
            content: { type: "string" },
          },
        },
      },
      model: { type: "string" },
      max_tokens: { type: "number" },
      frequency_penalty: { type: "number" },
      presence_penalty: { type: "number" },
      response_format: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["json_object"] },
        },
      },
      seed: { type: "number" },
      stop: { type: ["string", "array"], items: { type: "string" } },
      stream: { type: "boolean" },
      stream_options: {
        type: "object",
        properties: {
          include_usage: { type: "boolean" },
        },
      },
      temperature: { type: "number" },
      top_p: { type: "number" },
      n: { type: "number" },
      tools: {
        type: "array",
        items: {
          type: "object",
          required: ["type", "function"],
          properties: {
            type: { type: "string" },
            function: {
              type: "object",
              required: ["name"],
              properties: {
                name: { type: "string" },
                parameters: { type: "object" },
                description: { type: "string" },
              },
            },
          },
        },
      },
      tool_choice: { type: "object" },
      parallel_tool_calls: { type: "object" },
      user: { type: "string" },
    },
  };
}
