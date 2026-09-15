# paraphrase-local

A one-tab local replacement for QuillBot: paraphrase, summarize, and fix grammar. No accounts, no telemetry. Grammar checking never leaves your machine. Paraphrase and summarize send text only to the LLM provider whose key you put in `.env`.

Out of scope: browser and Word extensions, plagiarism checking, AI detection.

## Prerequisites

- Node.js 18 or newer
- Either an [Anthropic](https://console.anthropic.com/) or [OpenAI](https://platform.openai.com/api-keys) API key for paraphrase/summarize
- Java **or** Docker for local [LanguageTool](https://languagetool.org/) (grammar only)

## 1. API key

```bash
cp .env.example .env
```

Add **one** of:

- `ANTHROPIC_API_KEY=` (used first if both are set)
- `OPENAI_API_KEY=`

Optional: `ANTHROPIC_MODEL` (default `claude-sonnet-4-5`) or `OPENAI_MODEL` (default `gpt-4o-mini`).

## 2. LanguageTool (local grammar)

Default URL is `http://localhost:8010`. Override with `LANGUAGETOOL_URL` in `.env`.

### Docker

```bash
docker run -d --name languagetool -p 8010:8010 erikvl87/languagetool
```

### Java

1. Install a JDK (17+).
2. Download LanguageTool from https://languagetool.org/download/LanguageTool-stable.zip and unzip.
3. From the unzipped folder:

```bash
java -cp languagetool-server.jar org.languagetool.server.HTTPServer --port 8010 --allow-origin "*"
```

Confirm: `curl "http://localhost:8010/v2/check" --data "language=en-US&text=This are a test."`

## 3. Run the app

```bash
npm install
# If better-sqlite3 fails to load: npm install-scripts approve better-sqlite3 && npm rebuild better-sqlite3
npm start
```

Open http://localhost:5170

History lives at http://localhost:5170/history

`npm run dev` restarts the server when files change.

## Usage

- Paste text, pick a tone (standard, formal, casual, shorter), then **Paraphrase** or **Summarize**. Output streams from the LLM.
- **Fix grammar** talks to LanguageTool only. Click a suggested fix to apply it.
- Word-level diff compares input vs output.
- **Cmd+Enter** (macOS) or **Ctrl+Enter** runs the selected mode.
- Each successful run is stored in local SQLite (`data/history.db`).
