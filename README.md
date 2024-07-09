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
ANTHROPIC_VERTEX_PROJECT_ID=your-project-id
CLOUD_ML_REGION=us-east5
GOOGLE_APPLICATION_CREDENTIALS=./anthropic-vertex-credentials.json

# Network proxy settings (if needed)
HTTPS_PROXY=http://your-proxy-url:port

# ENSURE_FIRST_MODE options: 'continue' | 'remove'
# Default: 'remove'
ENSURE_FIRST_MODE=continue
```

## ENSURE_FIRST_MODE Explanation

The `ENSURE_FIRST_MODE` setting ensures that the first message in the conversation is always from the user. This is necessary because some AI models require the first message to be from the user. There are two modes:

- `remove` (default): If the first message is not from the user, it removes all assistant messages until it finds the first user message. This ensures that the conversation always starts with a user message.

- `continue`: If the first message is not from the user, it adds a new user message with the content "continue" at the beginning of the conversation. This preserves all existing messages while still ensuring that the first message is from the user.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[AGPL-3.0 License](LICENSE)
