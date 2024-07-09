export const claude_stop_to_openai_stop = (cl_stop: string) => {
  return (
    {
      max_tokens: "length",
      end_turn: "stop",
      stop_sequence: "content_filter",
      tool_use: "tool_calls",
    }[cl_stop] ?? cl_stop
  );
};

export const cloneDeep = <T>(x: T): T =>
  globalThis.structuredClone
    ? globalThis.structuredClone(x)
    : JSON.parse(JSON.stringify(x));
