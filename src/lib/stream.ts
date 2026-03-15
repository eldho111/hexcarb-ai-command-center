export type NdjsonItem = unknown;

async function readStreamText(
  stream: ReadableStream<Uint8Array>,
  onChunkText: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      if (signal?.aborted) return;
      const { value, done } = await reader.read();
      if (done) return;
      if (!value) continue;
      onChunkText(decoder.decode(value, { stream: true }));
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

export async function streamNdjson(
  stream: ReadableStream<Uint8Array>,
  onItem: (item: NdjsonItem, rawLine: string) => void,
  onBadLine: (line: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  let buffer = "";
  await readStreamText(
    stream,
    (text) => {
      buffer += text;
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          onItem(JSON.parse(trimmed) as NdjsonItem, trimmed);
        } catch {
          onBadLine(trimmed);
        }
      }
    },
    signal,
  );

  const tail = buffer.trim();
  if (!tail) return;
  try {
    onItem(JSON.parse(tail) as NdjsonItem, tail);
  } catch {
    onBadLine(tail);
  }
}

export type SseEvent = {
  event?: string;
  id?: string;
  data: string;
};

export async function streamSse(
  stream: ReadableStream<Uint8Array>,
  onEvent: (evt: SseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  let buffer = "";
  await readStreamText(
    stream,
    (text) => {
      buffer += text;
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const block of parts) {
        const lines = block.split("\n");
        const evt: SseEvent = { data: "" };
        const dataLines: string[] = [];
        for (const raw of lines) {
          const line = raw.trimEnd();
          if (!line || line.startsWith(":")) continue;
          const idx = line.indexOf(":");
          const key = (idx >= 0 ? line.slice(0, idx) : line).trim();
          const value = idx >= 0 ? line.slice(idx + 1).trimStart() : "";
          if (key === "event") evt.event = value;
          if (key === "id") evt.id = value;
          if (key === "data") dataLines.push(value);
        }
        evt.data = dataLines.join("\n");
        onEvent(evt);
      }
    },
    signal,
  );
}
