const TONE_INSTRUCTIONS = {
  standard: "Use a clear, neutral tone.",
  formal: "Use a formal, professional tone. Avoid contractions and slang.",
  casual: "Use a casual, conversational tone.",
  shorter: "Make the result noticeably shorter while keeping the meaning.",
};

const MODE_TASKS = {
  paraphrase:
    "Paraphrase the user's text. Keep the same meaning and roughly the same length unless the tone asks otherwise. Do not add a preamble or quotes.",
  summarize:
    "Summarize the user's text. Keep the important points. Do not add a preamble or quotes.",
};

export function buildPrompt(mode, tone) {
  const task = MODE_TASKS[mode];
  const toneLine = TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.standard;
  if (!task) throw new Error(`Unknown mode: ${mode}`);
  return `${task}\n${toneLine}\nReturn only the rewritten text.`;
}

function sseWrite(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function streamAnthropic({ apiKey, model, system, user, res }) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      stream: true,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic error ${response.status}: ${err.slice(0, 500)}`);
  }
  let output = "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n");
    buffer = chunks.pop() ?? "";
    for (const line of chunks) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload) continue;
      let json;
      try {
        json = JSON.parse(payload);
      } catch {
        continue;
      }
      if (json.type === "content_block_delta" && json.delta?.text) {
        output += json.delta.text;
        sseWrite(res, "token", { text: json.delta.text });
      }
    }
  }
  return output;
}

async function streamOpenAI({ apiKey, model, system, user, res }) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${err.slice(0, 500)}`);
  }
  let output = "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n");
    buffer = chunks.pop() ?? "";
    for (const line of chunks) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let json;
      try {
        json = JSON.parse(payload);
      } catch {
        continue;
      }
      const text = json.choices?.[0]?.delta?.content;
      if (text) {
        output += text;
        sseWrite(res, "token", { text });
      }
    }
  }
  return output;
}

export async function streamRewrite({ env, mode, tone, input, res }) {
  const system = buildPrompt(mode, tone);
  const anthropicKey = env.ANTHROPIC_API_KEY?.trim();
  const openaiKey = env.OPENAI_API_KEY?.trim();
  if (!anthropicKey && !openaiKey) {
    throw new Error(
      "No API key. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env (see README)."
    );
  }
  if (anthropicKey) {
    return streamAnthropic({
      apiKey: anthropicKey,
      model: env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-5",
      system,
      user: input,
      res,
    });
  }
  return streamOpenAI({
    apiKey: openaiKey,
    model: env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    system,
    user: input,
    res,
  });
}

export { sseWrite };
