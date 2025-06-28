import { SSEEvent } from "./models";

export function parseSSEMessage(message: string): SSEEvent | null {
  const lines = message.trim().split("\n");
  let event = "";
  let data = "";

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      event = line.slice(7);
    } else if (line.startsWith("data: ")) {
      data = line.slice(6);
    }
  }

  if (event && data) {
    return { event, data };
  }

  return null;
}

export function* parseSSEStream(text: string): Generator<SSEEvent> {
  const messages = text.split("\n\n");

  for (const message of messages) {
    if (message.trim()) {
      const parsed = parseSSEMessage(message);
      if (parsed) {
        yield parsed;
      }
    }
  }
}
