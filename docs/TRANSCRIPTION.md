# Transcription module (Phase 1)

## Stack

| Step | Provider | Why |
|------|----------|-----|
| Speech → text | **Deepgram** | Claude API cannot accept audio input |
| Summary + action items | **Claude** (Anthropic) | Your preferred LLM |

This matches [Anthropic's own cookbook](https://platform.claude.com/cookbook/third-party-deepgram-prerecorded-audio): transcribe externally, analyze with Claude.

## Setup

### 1. Anthropic (required)

Add to `apps/web/.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

Optional: use `claude-haiku-4-5-20251001` for cheaper/faster summaries.

### 2. Deepgram (required for audio upload)

Free tier: [console.deepgram.com](https://console.deepgram.com/)

```
DEEPGRAM_API_KEY=...
```

Without Deepgram you can still **paste transcript text** in the UI — Claude will summarize it.

### 3. Supabase table

Run in SQL Editor: `packages/storage/sql/transcriptions.sql`

### 4. Try it

[http://localhost:3000/transcription](http://localhost:3000/transcription) in Safari or Chrome.

## Notes

- Max audio file: 25 MB
- Claude never sees raw audio — only the transcript text
- Passkey login: use external browser, not Cursor Simple Browser
