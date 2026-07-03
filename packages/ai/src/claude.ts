export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ClaudeRequestOptions {
  system?: string
  messages: ClaudeMessage[]
  maxTokens?: number
  temperature?: number
}

function getAnthropicConfig() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'
  return { apiKey, model }
}

export async function createClaudeMessage(options: ClaudeRequestOptions): Promise<string> {
  const { apiKey, model } = getAnthropicConfig()

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
