import axios from 'axios';
import { ChatApiResponse, ChatRequest, StatsApiResponse } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

export async function sendChatMessage(payload: ChatRequest): Promise<ChatApiResponse> {
  const response = await api.post<ChatApiResponse>('/chat', payload);
  return response.data;
}

export interface StreamChatMessageOptions {
  onChunk: (chunk: string) => void;
  onMeta?: (meta: { language: string; displayName?: string }) => void;
  signal?: AbortSignal;
}

/**
 * Streams chat/voice response chunks using Server-Sent Events (SSE).
 * Calls onChunk as tokens arrive and returns the full aggregated response.
 */
export async function streamChatMessage(
  payload: ChatRequest,
  options: StreamChatMessageOptions
): Promise<string> {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Failed to stream chat: ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const jsonStr = trimmed.slice(6);
      try {
        const data = JSON.parse(jsonStr);
        if (data.meta && options.onMeta) {
          options.onMeta(data.meta);
        }
        if (data.chunk) {
          fullText += data.chunk;
          options.onChunk(data.chunk);
        }
        if (data.error) {
          throw new Error(data.error);
        }
      } catch (err: any) {
        if (err?.message && !err.message.includes('Unexpected end of JSON')) {
          console.warn('[streamChatMessage] Parse notice:', err.message);
        }
      }
    }
  }

  return fullText;
}

export async function fetchStats(): Promise<StatsApiResponse> {
  const response = await api.get<StatsApiResponse>('/stats');
  return response.data;
}

