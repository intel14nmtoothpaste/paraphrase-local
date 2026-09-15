export async function checkGrammar(baseUrl, text) {
  const url = `${baseUrl.replace(/\/$/, "")}/v2/check`;
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ language: "en-US", text }),
    });
  } catch (err) {
    throw new Error(
      `LanguageTool is not reachable at ${url}. Start it with Docker or Java (see README). ${err.message}`
    );
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LanguageTool error ${response.status}: ${body.slice(0, 400)}`);
  }
  const data = await response.json();
  const matches = Array.isArray(data.matches) ? data.matches : [];
  return matches.map((m) => ({
    message: m.message,
    shortMessage: m.shortMessage || "",
    offset: m.offset,
    length: m.length,
    replacements: (m.replacements || []).slice(0, 8).map((r) => r.value),
  }));
}

export function applyReplacement(text, offset, length, replacement) {
  return text.slice(0, offset) + replacement + text.slice(offset + length);
}
