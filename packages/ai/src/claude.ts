export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ClaudeRequestOptions {
  system?: string | { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }[]
  messages: ClaudeMessage[]
  maxTokens?: number
  temperature?: number
  model?: string
}

function getAnthropicConfig(modelOverride?: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }
  const model = modelOverride || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'
  return { apiKey, model }
}

export async function createClaudeMessage(options: ClaudeRequestOptions): Promise<string> {
  const { apiKey, model } = getAnthropicConfig(options.model)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.3,
      system: options.system,
      messages: options.messages,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Claude API error (${response.status}): ${body}`)
  }

  const data = (await response.json()) as {
    content?: { type: string; text?: string }[]
  }

  const text = data.content
    ?.filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('')
    .trim()

  if (!text) {
    throw new Error('Claude returned empty response')
  }

  return text
}

/** Stream text deltas from Claude Messages API (SSE). */
export async function* streamClaudeMessage(
  options: ClaudeRequestOptions,
): AsyncGenerator<string, void, unknown> {
  const { apiKey, model } = getAnthropicConfig(options.model)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.3,
      system: options.system,
      messages: options.messages,
      stream: true,
    }),
  })

  if (!response.ok || !response.body) {
    const body = await response.text()
    throw new Error(`Claude stream error (${response.status}): ${body}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n')
    buffer = parts.pop() ?? ''
    for (const line of parts) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const evt = JSON.parse(payload) as {
          type?: string
          delta?: { type?: string; text?: string }
        }
        if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta' && evt.delta.text) {
          yield evt.delta.text
        }
      } catch {
        // skip malformed SSE chunk
      }
    }
  }
}
