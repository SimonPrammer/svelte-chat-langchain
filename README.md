# Svelte Chat Langchain (mini version)

This is a (mini) version of Chat Langchain (https://github.com/langchain-ai/chat-langchain) implemented in SvelteKit!
I call it a mini version because it does not include some of the more advanced features of the original Chat Langchain, such as Indexing / Record Management, user feedback and stream parsing to display sources.

It does however include core features of QA Applications, such as:

- Ingestion
  - Document Loading (from Langchain JS docs https://js.langchain.com/docs/get_started/introduction)
  - Document Splitting
  - Setting up and using VercelPostgres as VectorDb
- Retrieval
- Complex & Conditional Chaining with Langchain Expression Language
- Streaming (simplified with Vercel AI SDK)

This repository is fully inspired by the original Chat Langchain repository. All credit goes to them.

# Official Langchain Chat Website

https://chat.langchain.com/

# Official Langchain Chat Github

https://github.com/langchain-ai/chat-langchain

# Official Langchain Blog

https://blog.langchain.dev/building-chat-langchain-2/

## Setup

Install dependencies.

```sh
pnpm i
```

Run the development server at http://localhost:5173/.

```sh
pnpm run dev
```
