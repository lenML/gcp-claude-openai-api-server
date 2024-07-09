import { OpenAI_NS } from "./tyeps";
import { cloneDeep } from "./utils";

import {
  tokenizerJSON,
  tokenizerConfig,
} from "@lenml/tokenizer-claude/src/data.ts";
import { TokenizerLoader } from "@lenml/tokenizers/src/main.ts";

const rename_roles = {
  user: "Human",
  assistant: "Assistant",
  example_user: "H",
  example_assistant: "A",
} as Record<string, string>;

const tokenizer = TokenizerLoader.fromPreTrained({
  tokenizerConfig,
  tokenizerJSON,
});

export enum SystemMergeMode {
  /**
   * 合并所有 system 到一起，无视其他 role 顺序
   */
  merge_all = "merge_all",
  /**
   * 合并所有 top 的 system 到一起，其余 system 作为 user prompt suffix
   *
   * this is the default mode
   */
  merge_top_user = "merge_top_user",
  /**
   * 合并所有 top 的 system 到一起，其余 system 作为 assistant prompt suffix
   */
  merge_top_assistant = "merge_top_assistant",
  /**
   * 只使用第一个 system 作为 system prompt，其余作为 user prompt suffix
   */
  only_first_user = "only_first_user",
  /**
   * 只使用第一个 system 作为 system prompt，其余作为 assistant prompt suffix
   */
  only_first_assistant = "only_first_assistant",
  /**
   * 只使用第一个 system 作为 system prompt，其余忽略
   */
  only_first_remove = "only_first_remove",
}

export enum PromptMergeMode {
  /**
   * 除了 system 以外的所有消息都会被合并到一个 user message 中
   */
  all = "all",
  /**
   * 除了 system 合并其余不合并
   *
   * this is the default mode
   */
  only_system = "only_system",
}

type MessageType<T extends string> = { role: T; content: string };
type PromptMergeOptions = {
  system_merge_mode: SystemMergeMode;
  prompt_merge_mode: PromptMergeMode;
  max_token_length: number;
  join_string: string;
};

/**
 * 用于合并 prompt
 *
 * 背景： 由于 claude 不支持插入 system ，但是 openai api 需要这种特性，所以使用此类来合并 prompt
 */
export class PromptMerger {
  private options: PromptMergeOptions;

  constructor(
    private messages: OpenAI_NS.CompletionRequest["messages"],
    options: Partial<PromptMergeOptions> = {}
  ) {
    this.options = {
      system_merge_mode: SystemMergeMode.merge_top_user,
      prompt_merge_mode: PromptMergeMode.only_system,
      max_token_length: 4096,
      join_string: "\n----\n",
      ...options,
    };
  }

  /**
   *
   * NOTE: 目前 system 合并无视 max_token_length
   */
  private process_system_prompt() {
    const { messages } = this;
    const new_messages = cloneDeep(messages);

    const system_messages = new_messages
      .filter((m) => m.role === "system")
      .map((x) => {
        const index = new_messages.indexOf(x);
        const before_msgs = new_messages.slice(0, index);
        const after_msgs = new_messages.slice(index + 1);
        const before_user_msg = [...before_msgs]
          .reverse()
          .find((m) => m.role === "user");
        const after_user_msg = after_msgs.find((m) => m.role === "user");
        const before_assistant_msg = [...before_msgs]
          .reverse()
          .find((m) => m.role === "assistant");
        const after_assistant_msg = after_msgs.find(
          (m) => m.role === "assistant"
        );

        return {
          index,
          message: x as MessageType<"system">,
          closest_user_msg:
            before_user_msg ||
            (after_user_msg as MessageType<"user"> | undefined),
          closest_assistant_msg:
            before_assistant_msg ||
            (after_assistant_msg as MessageType<"assistant"> | undefined),
        };
      });

    let system_prompt = "";

    const merge_top_with = (role: "user" | "assistant") => {
      let in_top = true;
      const system_prompts = [] as string[];
      for (const prompt of new_messages) {
        if (in_top) {
          if (prompt.role === "system") {
            system_prompts.push(prompt.content);
          } else {
            in_top = false;
          }
        } else {
          if (prompt.role === "system") {
            const { closest_assistant_msg, closest_user_msg } =
              system_messages.find((m) => m.message === prompt)!;
            switch (role) {
              case "assistant": {
                if (closest_assistant_msg) {
                  closest_assistant_msg.content += `${this.options.join_string}${prompt.content}`;
                } else {
                  // maybe is Error?
                }
                break;
              }
              case "user": {
                if (closest_user_msg) {
                  closest_user_msg.content += `${this.options.join_string}${prompt.content}`;
                } else {
                  // maybe is Error?
                }
                break;
              }
            }
          }
        }
      }
    };

    const only_first_with = (role: "user" | "assistant" | "remove") => {
      const first_system = system_messages[0];
      if (first_system) {
        system_prompt = first_system.message.content;
      }

      if (role !== "remove") {
        system_prompt = first_system.message.content;
        const suffix = system_messages
          .slice(1)
          .map((m) => m.message.content)
          .join(this.options.join_string);
        if (suffix) {
          new_messages.push({
            role,
            content: suffix,
          });
        }
      }
    };

    switch (this.options.system_merge_mode) {
      case SystemMergeMode.merge_all: {
        system_prompt = system_messages
          .map((m) => m.message.content)
          .join(this.options.join_string);
        break;
      }
      case SystemMergeMode.merge_top_user: {
        merge_top_with("user");
        break;
      }
      case SystemMergeMode.merge_top_assistant: {
        merge_top_with("assistant");
        break;
      }
      case SystemMergeMode.only_first_user: {
        only_first_with("user");
        break;
      }
      case SystemMergeMode.only_first_assistant: {
        only_first_with("assistant");
        break;
      }
      case SystemMergeMode.only_first_remove: {
        only_first_with("remove");
        break;
      }
      default: {
        throw new Error(
          `unknown system merge mode: ${this.options.system_merge_mode}`
        );
      }
    }

    return {
      messages: new_messages.filter((m) => m.role !== "system"),
      system_prompt,
    };
  }

  /**
   * Takes an OpenAI message and translates it into a format of "Role: Message"
   * Messages from the System role are send as is.
   * For example dialogue it takes the actual role from the 'name' property instead.
   * By default the role "user" is replaced with "Human" and the role "assistant" with "Assitant"
   * @param {OpenAI_NS.CompletionRequest['messages'][number]} msg
   * @returns {string}
   */
  private convertToPrompt(
    msg: OpenAI_NS.CompletionRequest["messages"][number] & {
      name?: string;
    }
  ) {
    if (msg.role === "system") {
      // this SillyTavern request payload data
      if ("name" in msg && msg.name) {
        return `${rename_roles[msg.name]}: ${msg.content}\n\n`;
      } else {
        return `${msg.content}\n\n`;
      }
    } else {
      return `${rename_roles[msg.role]}: ${msg.content}\n\n`;
    }
  }

  private get_token_length(text: string) {
    return tokenizer.encode(text, null, { add_special_tokens: false }).length;
  }

  /**
   * 合并 messages
   */
  private merge_messages(messages: OpenAI_NS.CompletionRequest["messages"]) {
    const merged_messages = [] as OpenAI_NS.CompletionRequest["messages"];

    let current_message = "";
    for (const message of messages) {
      const new_message = this.convertToPrompt(message);
      if (
        this.get_token_length(current_message + new_message) <=
        this.options.max_token_length
      ) {
        current_message += `${this.options.join_string}${new_message}`;
      } else {
        merged_messages.push({
          role: "user",
          content: current_message,
        });
        current_message = new_message;
      }
    }

    return merged_messages;
  }

  merge() {
    switch (this.options.prompt_merge_mode) {
      case PromptMergeMode.all: {
        const { messages, system_prompt } = this.process_system_prompt();
        return {
          messages: this.merge_messages(messages),
          system_prompt,
        };
        break;
      }
      case PromptMergeMode.only_system: {
        const { messages, system_prompt } = this.process_system_prompt();
        return {
          messages,
          system_prompt,
        };
      }
      default: {
        throw new Error(
          `unknown prompt merge mode: ${this.options.prompt_merge_mode}`
        );
      }
    }
  }
}
