# gcp-claude-openai-api-server

[![GitHub repo](https://img.shields.io/badge/github-repo-blue?logo=github)](https://github.com/lenML/gcp-claude-openai-api-server)

This project converts [Vertex AI API](https://console.cloud.google.com/marketplace/product/google/aiplatform.googleapis.com) to [OpenAI API](https://platform.openai.com/docs/api-reference) format.

## Features

- Provides an OpenAI-compatible API
- Forwards requests to your Vertex AI API
- Easy configuration and setup

## Prerequisites

Before you begin, ensure you have:
- A Google Cloud Platform account with Vertex AI API enabled
- Service account credentials with necessary permissions

## Configuration

Configure the following environment variables (can be set in a `.env` file):

- `ANTHROPIC_VERTEX_PROJECT_ID`: Your GCP project ID
- `CLOUD_ML_REGION`: The GCP region for Vertex AI (e.g., us-east5)
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to your service account JSON file

Optional:
- `HTTPS_PROXY`: If you need to use a proxy

> Note: The `GOOGLE_APPLICATION_CREDENTIALS` file contains high-level service account permissions. Keep it secure.

## Installation and Usage

### Using Pre-built Binaries

1. Download the latest release for your platform (Windows/Mac/Linux) from the [releases page](https://github.com/lenML/gcp-claude-openai-api-server/releases).
2. Create or edit a `.env` file in the same directory as the binary.
3. Run the binary.

### Building from Source

```bash
git clone https://github.com/lenML/gcp-claude-openai-api-server.git
cd gcp-claude-openai-api-server
pnpm install
pnpm start
```

## Configuration Example

Here's a sample `.env` file:

```env
# Anthropic Vertex AI configuration
ANTHROPIC_VERTEX_PROJECT_ID=
CLOUD_ML_REGION=us-east5
GOOGLE_APPLICATION_CREDENTIALS=./anthropic-vertex-credentials.json

# Network proxy settings
HTTP_PROXY=
HTTPS_PROXY=

# Conversation processing settings

# Handling of the first message
# Possible values: `continue` | `remove`
# default value: `remove`
ENSURE_FIRST_MODE=continue

# Message merging mode
# Possible values: `all` | `only_system`
# default value: `only_system`
PROMPT_MERGE_MODE=only_system

# System message merging mode
# Possible values: `merge_all` | `merge_top_user` | `merge_top_assistant` | `only_first_user` | `only_first_assistant` | `only_first_remove`
# default value: `merge_top_user`
SYSTEM_MERGE_MODE=merge_top_user

# Maximum token length for the conversation
# default value: 4096
MAX_TOKEN_LENGTH=4096
```

## System Variables Explanation

### ENSURE_FIRST_MODE

```typescript
export const ensure_first_mode = process.env.ENSURE_FIRST_MODE ?? "remove";
```

The `ENSURE_FIRST_MODE` setting determines how the system handles the first message in the conversation. It has two possible values:

- `"remove"` (default): If the first message is not from the user, it removes all assistant messages until it finds the first user message. This ensures that the conversation always starts with a user message.
- `"continue"`: If the first message is not from the user, it adds a new user message with the content "continue" at the beginning of the conversation. This preserves all existing messages while still ensuring that the first message is from the user.

### PROMPT_MERGE_MODE

```typescript
export const prompt_merge_mode = process.env.PROMPT_MERGE_MODE ?? "only_system";
```

The `PROMPT_MERGE_MODE` setting determines how messages are merged in the conversation. It corresponds to the `PromptMergeMode` enum and has two possible values:

- `"only_system"` (default): Only system messages are merged, while other messages remain separate.
- `"all"`: All messages except system messages are merged into a single user message.

### SYSTEM_MERGE_MODE

```typescript
export const system_merge_mode = process.env.SYSTEM_MERGE_MODE ?? "merge_top_user";
```

The `SYSTEM_MERGE_MODE` setting determines how system messages are handled and merged. It corresponds to the `SystemMergeMode` enum and has several possible values:

- `"merge_top_user"` (default): Merges all top system messages together, and treats the remaining system messages as user prompt suffixes.
- `"merge_all"`: Merges all system messages together, ignoring the order of other roles.
- `"merge_top_assistant"`: Merges all top system messages together, and treats the remaining system messages as assistant prompt suffixes.
- `"only_first_user"`: Uses only the first system message as the system prompt, and treats the remaining system messages as user prompt suffixes.
- `"only_first_assistant"`: Uses only the first system message as the system prompt, and treats the remaining system messages as assistant prompt suffixes.
- `"only_first_remove"`: Uses only the first system message as the system prompt and ignores the rest.

### MAX_TOKEN_LENGTH

```typescript
export const max_token_length = parseInt(process.env.MAX_TOKEN_LENGTH ?? "4096");
```

The `MAX_TOKEN_LENGTH` setting determines the maximum number of tokens allowed in the conversation. It is parsed as an integer from the environment variable, with a default value of 4096 if not specified.

> This configuration is used when merging prompts and does not affect API call parameters.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[AGPL-3.0 License](LICENSE)
