import { env } from '../../config/env.js';
import { fetchJSON } from './http.js';

export type LlmName = 'groq' | 'gemini' | 'openai';

export function activeProvider(): LlmName | null {
  if (env.GROQ_API_KEY) return 'groq';
  if (env.GEMINI_API_KEY) return 'gemini';
  if (env.OPENAI_API_KEY) return 'openai';
  return null;
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.search(/[[{]/);
  return JSON.parse(start > 0 ? body.slice(start) : body);
}

/** Asks the first configured LLM for a JSON object. Returns null when no provider is configured or the call fails. */
export async function llmJson<T>(system: string, user: string, timeoutMs = 25000): Promise<{ data: T; provider: LlmName } | null> {
  const provider = activeProvider();
  if (!provider) return null;
  try {
    let text = '';
    if (provider === 'gemini') {
      const r = await fetchJSON<{ candidates?: Array<{ content: { parts: Array<{ text: string }> } }> }>(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.6 },
          }),
          timeoutMs,
        },
      );
      text = r.candidates?.[0]?.content.parts.map((p) => p.text).join('') ?? '';
    } else {
      const url = provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
      const key = provider === 'groq' ? env.GROQ_API_KEY : env.OPENAI_API_KEY;
      const model = provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4.1-mini';
      const r = await fetchJSON<{ choices: Array<{ message: { content: string } }> }>(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature: 0.6,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
        timeoutMs,
      });
      text = r.choices[0]?.message.content ?? '';
    }
    return { data: extractJson(text) as T, provider };
  } catch (err) {
    console.warn(`  ↯ llm(${provider}): ${(err as Error).message}`);
    return null;
  }
}
