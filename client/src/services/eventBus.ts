// ================================================================
// eventBus.ts — Realtime Event Stream & Action Timeline
// Connects AI agent tools, router, UI state, and global assistant
// ================================================================

export type AgentRealtimeEventType =
  | 'ASSISTANT_LISTENING'
  | 'ASSISTANT_THINKING'
  | 'ASSISTANT_SPEAKING'
  | 'ASSISTANT_IDLE'
  | 'ACTION_STARTED'
  | 'ACTION_COMPLETE'
  | 'ACTION_FAILED'
  | 'NAVIGATION_START'
  | 'NAVIGATION_COMPLETE'
  | 'ROUTE_CHANGED'
  | 'PAGE_LOADING'
  | 'PAGE_READY'
  | 'FORM_DETECTED'
  | 'FORM_FILL_STARTED'
  | 'FORM_FIELD_FILLED'
  | 'WAITING_FOR_CONFIRMATION'
  | 'UI_STATE_UPDATE'
  | 'TRANSCRIPT_STREAM';

export interface TimelineEntry {
  id: string;
  timestamp: string;
  timeMs: number;
  type: AgentRealtimeEventType;
  action?: string;
  target?: string;
  message?: string;
  data?: Record<string, unknown>;
}

export interface AgentRealtimeEvent {
  type: AgentRealtimeEventType;
  action?: string;
  target?: string;
  route?: string;
  title?: string;
  message?: string;
  data?: Record<string, unknown>;
  timestamp?: number;
}

type EventListener = (event: AgentRealtimeEvent) => void;

class AgentEventBus {
  private listeners: Set<EventListener> = new Set();
  private timeline: TimelineEntry[] = [];
  private maxTimelineSize = 50;

  /**
   * Subscribe to realtime events
   */
  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Emit an event to all subscribers and append to action timeline
   */
  emit(event: AgentRealtimeEvent): void {
    const timeMs = event.timestamp || Date.now();
    const now = new Date(timeMs);
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

    const entry: TimelineEntry = {
      id: `ev-${timeMs}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: timeStr,
      timeMs,
      type: event.type,
      action: event.action,
      target: event.target || event.route,
      message: event.message,
      data: event.data,
    };

    this.timeline.unshift(entry);
    if (this.timeline.length > this.maxTimelineSize) {
      this.timeline.pop();
    }

    // Notify all listeners synchronously
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[AgentEventBus] Listener error:', err);
      }
    });
  }

  /**
   * Get the action timeline history for debugging and UI display
   */
  getTimeline(): TimelineEntry[] {
    return [...this.timeline];
  }

  /**
   * Clear timeline
   */
  clearTimeline(): void {
    this.timeline = [];
  }
}

export const eventBus = new AgentEventBus();
