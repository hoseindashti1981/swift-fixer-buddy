import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Input = z.object({
  question: z.string().min(2).max(1000),
  context: z.string().max(60000).optional(),
});

const SYSTEM = `تو یک تکنسین ارشد و متخصص تعمیر پکیج شوفاژ دیواری هستی.
به فارسی روان و کوتاه جواب بده. جواب را با ساختار مارک‌داون بده:
## علائم
## علت‌های احتمالی (به ترتیب احتمال)
## مراحل عیب‌یابی
## راه‌حل
## نکات ایمنی
اگر مطالب راهنمای کاربر در اختیارت گذاشته شد، اول به آن‌ها تکیه کن و بعد دانش خودت را اضافه کن.
از حدس‌های خطرناک پرهیز کن و اگر کار نیاز به تجهیزات یا تخصص گاز دارد، هشدار بده.`;

export const Route = createFileRoute("/api/ai-ask")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) {
          return new Response("سرویس هوش مصنوعی تنظیم نشده است.", { status: 500 });
        }

        let parsed: z.infer<typeof Input>;
        try {
          parsed = Input.parse(await request.json());
        } catch {
          return new Response("سؤال نامعتبر است.", { status: 400 });
        }

        const prompt = parsed.context
          ? `سؤال کاربر:\n${parsed.question}\n\nمطالب مرتبط از راهنمای کاربر:\n${parsed.context}`
          : `سؤال کاربر:\n${parsed.question}`;

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": key,
            "X-Lovable-AIG-SDK": "fetch",
          },
          body: JSON.stringify({
            model: "openai/gpt-6-astra",
            instructions: SYSTEM,
            input: prompt,
            stream: true,
            reasoning: { effort: "low", summary: "auto" },
          }),
          signal: request.signal,
        });

        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text().catch(() => "");
          const message =
            upstream.status === 402
              ? "اعتبار هوش مصنوعی تمام شده است. لطفاً اعتبار حساب را شارژ کنید."
              : upstream.status === 429
                ? "درخواست‌ها زیاد است، کمی بعد دوباره تلاش کنید."
                : `خطای سرویس هوش مصنوعی (${upstream.status}). ${detail.slice(0, 200)}`;
          return new Response(message, { status: upstream.status || 500 });
        }

        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = "";

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const reader = upstream.body!.getReader();
            try {
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                  if (!line.startsWith("data:")) continue;
                  const payload = line.slice(5).trim();
                  if (!payload || payload === "[DONE]") continue;
                  try {
                    const event = JSON.parse(payload) as { type?: string; delta?: string };
                    if (event.type === "response.output_text.delta" && event.delta) {
                      controller.enqueue(encoder.encode(event.delta));
                    }
                  } catch {
                    // ignore partial/unknown events
                  }
                }
              }
              controller.close();
            } catch (error) {
              controller.error(error);
            }
          },
        });

        return new Response(stream, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
