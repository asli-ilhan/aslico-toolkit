export type ToolkitEvents = {
  'transcription.completed': {
    id: string
    text: string
    duration: number
  }
  'document.updated': {
    docId: string
    module: string
  }
  'newsletter.generated': {
    editionId: string
    topics: string[]
  }
  'book.finished': {
    bookId: string
    title: string
  }
  'lesson.completed': {
    lessonId: string
    language: string
    score: number
  }
  'calendar.event.created': {
    eventId: string
    title: string
  }
  'job.application.sent': {
    applicationId: string
    company: string
  }
}

type EventHandler<K extends keyof ToolkitEvents> = (
  payload: ToolkitEvents[K],
) => void | Promise<void>

type ListenerMap = {
  [K in keyof ToolkitEvents]?: Set<EventHandler<K>>
}

class EventBus {
  private listeners: ListenerMap = {}

  on<K extends keyof ToolkitEvents>(event: K, handler: EventHandler<K>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set()
    }
    this.listeners[event]!.add(handler as EventHandler<K>)
    return () => this.off(event, handler)
  }

  off<K extends keyof ToolkitEvents>(event: K, handler: EventHandler<K>): void {
    this.listeners[event]?.delete(handler as EventHandler<K>)
  }

  async emit<K extends keyof ToolkitEvents>(
    event: K,
    payload: ToolkitEvents[K],
  ): Promise<void> {
    const handlers = this.listeners[event]
    if (!handlers) return
    await Promise.all([...handlers].map((h) => h(payload)))
  }
}

export const eventBus = new EventBus()
export { EventBus }
