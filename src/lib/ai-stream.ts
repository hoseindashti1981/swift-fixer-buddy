export async function* readLines(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        buffer += decoder.decode();
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      if (buffer.length > 1_000_000) {
        throw new Error("پاسخ سرویس بیش از حد بزرگ است.");
      }

      let newlineIndex: number;

      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) {
          line = line.slice(0, -1);
        }

        yield line;
      }
    }

    if (buffer) {
      yield buffer.endsWith("\r") ? buffer.slice(0, -1) : buffer;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Stream may already be closed.
    }

    reader.releaseLock();
  }
}

export async function* responseDeltas(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  for await (const line of readLines(stream)) {
    // OpenAI Responses API uses SSE.
    // We only need the "data:" lines.
    if (!line.startsWith("data:")) {
      continue;
    }

    const payload = line.slice(5).trim();

    if (!payload || payload === "[DONE]") {
      continue;
    }

    let event: any;

    try {
      event = JSON.parse(payload);
    } catch {
      throw new Error(
        `پاسخ نامعتبر از OpenAI دریافت شد: ${payload.slice(0, 300)}`,
      );
    }

    switch (event.type) {
      case "response.output_text.delta": {
        if (typeof event.delta === "string") {
          yield event.delta;
        }
        break;
      }

      case "response.refusal.delta": {
        if (typeof event.delta === "string") {
          yield event.delta;
        }
        break;
      }

      case "response.completed": {
        return;
      }

      case "response.failed": {
        const message =
          event.response?.error?.message ??
          event.response?.error?.code ??
          "OpenAI response failed";

        throw new Error(message);
      }

      case "response.incomplete": {
        const reason =
          event.response?.incomplete_details?.reason ??
          "unknown reason";

        throw new Error(`OpenAI response incomplete: ${reason}`);
      }

      case "error": {
        const message =
          event.message ??
          event.error?.message ??
          event.error?.code ??
          event.code ??
          "OpenAI stream error";

        throw new Error(message);
      }

      default:
        // Other Responses API events such as:
        // response.created
        // response.in_progress
        // response.output_item.added
        // response.content_part.added
        // response.output_text.done
        // response.content_part.done
        // response.output_item.done
        // are intentionally ignored.
        break;
    }
  }

  throw new Error("ارتباط با OpenAI پیش از تکمیل پاسخ قطع شد.");
}