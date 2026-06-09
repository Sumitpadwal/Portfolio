# Sumit Padwal Portfolio + Local AI Agent

This repository keeps the existing static portfolio and adds a bottom-right AI chat widget backed by a local retrieval-augmented generation (RAG) service.

The agent reads Sumit's local profile files and supports two retrieval indexes:

- Local development uses MiniLM embeddings and Vectra under `vector_store/`.
- Vercel uses compact deterministic feature-hash embeddings under `deploy_vector_store/` without API keys, ONNX, or model binaries.

The hosted agent is fully keyless. It performs local vector retrieval and returns extractive answers grounded in the committed profile data.

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

The first local ingestion downloads the MiniLM model into `.cache/models/`. Local model files and the Vectra index are excluded from Git.

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
npm run ingest:deploy
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

1. Import the GitHub repository into Vercel.
2. Deploy. No API key or Vercel environment variable is required.
3. Vercel detects `api/chat.js` and `api/health.js` as Node.js functions.
4. `vercel.json` selects the Other framework preset, disables the frontend build command, uses the repository root for static files, and bundles only `deploy_vector_store/`.
5. The hosted response style is extractive and concise because it does not call an external LLM.

After changing files in `data/`, run both ingestion commands, commit the updated `deploy_vector_store/`, and redeploy.

## GitHub Commands

Review the changes:

```bash
git status
git diff
```

Commit and push:

```bash
git add .gitignore .env.example README.md package.json package-lock.json api backend data deploy_vector_store vercel.json index.html style.css script.js
git commit -m "Add local RAG portfolio AI agent"
git push origin main
```

If the current branch is not `main`, replace `main` with the output of `git branch --show-current`.
