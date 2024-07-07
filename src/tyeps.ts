export namespace OpenAI_NS {
  export type CompletionRequest = {
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
}

export type CreatePayload = {
  created: number;
  system: string | undefined;
  messages: {
    role: "user" | "assistant";
    content: string;
  }[];
  model: string;
  max_tokens: number;
  temperature: number;
  top_p: number;
  stop_sequences: string[] | undefined;
};
