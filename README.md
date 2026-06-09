# Sumit Padwal Portfolio + Local AI Agent

This repository keeps the existing static portfolio and adds a bottom-right AI chat widget backed by a local retrieval-augmented generation (RAG) service.

The agent reads Sumit's local profile files, chunks them, creates MiniLM embeddings locally, and stores the vectors in a file-backed Vectra database under `vector_store/`. API keys are used only by the server for optional answer generation and are never sent to the browser.

## Architecture

- `data/` - local source-of-truth profile files
- `backend/ingest.js` - reads, chunks, embeds, and indexes the profile
- `backend/embeddings.js` - local MiniLM embedding model
- `backend/vector-store.js` - Vectra local vector database setup and search
- `backend/retriever.js` - semantic and lexical retrieval
- `backend/providers.js` - grounded OpenAI, Gemini, or local fallback answers
- `backend/server.js` - static website server and `POST /api/chat`
- `index.html`, `style.css`, `script.js` - existing portfolio plus isolated chat widget

## Prerequisites

- Node.js 20 or newer
- Internet access for the first model download and for OpenAI or Gemini requests

## Install

```bash
npm install
```

The first ingestion downloads the local embedding model into `.cache/models/`. The cache and generated vector index are excluded from Git.

## Add Profile Data

Add or edit `.md` and `.txt` files in `data/`. Suggested files include:

```text
data/
  agent_rules.md
  profile_overview.md
  projects.md
  skills.md
  education.md
  experience.md
  career_goals.md
  github.md
  resume.txt
```

Do not place secrets, private immigration documents, API keys, or confidential files in this folder.

The local profile files are currently structured from `PERSONAL AI AGENT KNOWLEDGE BASE.docx`. Re-run ingestion after changing or replacing any source information.

## Configure an LLM

Copy `.env.example` to `.env` and add one key:

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
```

or:

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
```

If neither key is present, the agent still runs with a simple local grounded-answer fallback. For the best conversational responses, configure OpenAI or Gemini.

Never commit `.env`.

## Build the Local Vector Index

Run this after any profile file changes:

```bash
npm run ingest
```

## Run Locally

```bash
npm start
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000).

Health check: `GET /api/health`

Chat endpoint:

```text
POST /api/chat
Content-Type: application/json

{"question":"What are Sumit's strongest projects?"}
```

## Safe Deployment

The existing static site can still be deployed by itself, but the AI chat requires a Node-compatible backend host with persistent access to the generated vector index.

1. Run `npm install` and `npm run ingest` during the build step.
2. Set `OPENAI_API_KEY` or `GEMINI_API_KEY` in the hosting provider's secret manager.
3. Start the service with `npm start`.
4. Never expose keys in `script.js`, HTML, build-time public variables, or Git.
5. For a split frontend/backend deployment, set the chat fetch URL to the secured backend origin and configure a narrow CORS allowlist.

## GitHub Commands

Review the changes:

```bash
git status
git diff
```

Commit and push:

```bash
git add .gitignore .env.example README.md package.json package-lock.json data backend index.html style.css script.js
git commit -m "Add local RAG portfolio AI agent"
git push origin main
```

If the current branch is not `main`, replace `main` with the output of `git branch --show-current`.
