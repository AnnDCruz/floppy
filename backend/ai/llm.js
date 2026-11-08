// Provider-agnostic "give me JSON" call.
//
// Default is a local Ollama model (free, private). Any OpenAI-compatible host
// (Groq, Gemini's OpenAI endpoint, OpenRouter, ...) works by env config:
//
//   LLM_PROVIDER=ollama   (default)  OLLAMA_URL, OLLAMA_MODEL
//   LLM_PROVIDER=openai              LLM_BASE_URL, LLM_API_KEY, LLM_MODEL
//
// Nothing here is specific to planning, so the same function can serve future agents.

const provider = () => (process.env.LLM_PROVIDER || "ollama").toLowerCase();

function modelName() {
  return provider() === "ollama"
    ? process.env.OLLAMA_MODEL || "qwen2.5:7b"
    : process.env.LLM_MODEL || "(set LLM_MODEL)";
}

function parseJSON(text) {
  const cleaned = String(text).trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // Fall back to the outermost {...} in case the model added chatter around it.
    const a = cleaned.indexOf("{");
    const b = cleaned.lastIndexOf("}");
    if (a !== -1 && b > a) return JSON.parse(cleaned.slice(a, b + 1));
    throw new Error("Model did not return valid JSON");
  }
}

async function ollama({ system, user, schema }) {
  const base = process.env.OLLAMA_URL || "http://localhost:11434";
  let res;
  try {
    res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(Number(process.env.LLM_TIMEOUT_MS) || 180000),
      body: JSON.stringify({
        model: modelName(),
        stream: false,
        format: schema, // constrains output to the JSON schema
        options: { temperature: 0.2, num_ctx: 8192 },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch (e) {
    if (e.name === "TimeoutError") throw new Error("The local model took too long to respond");
    throw new Error(
      `Couldn't reach Ollama at ${base}. Install it from ollama.com, then run: ollama pull ${modelName()}`
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 404) throw new Error(`Model "${modelName()}" isn't installed. Run: ollama pull ${modelName()}`);
    throw new Error(`Ollama error ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return parseJSON(data.message?.content ?? "");
}

async function openaiCompatible({ system, user, schema }) {
  const base = process.env.LLM_BASE_URL;
  if (!base) throw new Error("LLM_BASE_URL is not set (needed when LLM_PROVIDER=openai)");
  const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.LLM_API_KEY ? { Authorization: `Bearer ${process.env.LLM_API_KEY}` } : {}),
    },
    signal: AbortSignal.timeout(Number(process.env.LLM_TIMEOUT_MS) || 60000),
    body: JSON.stringify({
      model: modelName(),
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        // Not every host enforces a schema, so describe it in the prompt as well.
        { role: "system", content: `${system}\n\nReply with ONLY a JSON object matching this JSON Schema:\n${JSON.stringify(schema)}` },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LLM API error ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return parseJSON(data.choices?.[0]?.message?.content ?? "");
}

async function completeJSON(args) {
  return provider() === "ollama" ? ollama(args) : openaiCompatible(args);
}

module.exports = { completeJSON, modelName, provider };
