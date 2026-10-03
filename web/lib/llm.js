const SYSTEM = `You are a PostgreSQL analyst. Convert the user's question into ONE read-only SQL query.
Only table you may use: v_sales (one row per order).
Columns: order_id int, order_date date (2024-01-01..2026-09-30), region text, status text, segment text, country text, category text, product text, quantity int, revenue numeric, profit numeric.
Values: region in ('North America','Europe','Asia Pacific','Middle East','Latin America'); category in ('Electronics','Furniture','Office Supplies','Apparel','Home & Kitchen'); segment in ('Consumer','Corporate','Small Business'); status in ('completed','returned','cancelled').
Rules: always use AS for aliases; filter status = 'completed' unless the question is about returns/cancellations; round money to 2 decimals; order results sensibly; max 50 rows; no semicolons or comments.
Reply ONLY with JSON: {"sql": "...", "chart": "bar" | "line" | "table", "title": "short title"}.
Use "line" for time series, "bar" for category comparisons, "table" otherwise. If the question can't be answered from v_sales, reply {"sql": "", "chart": "table", "title": "Cannot answer"}.`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callModel(model, question) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: question }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    }),
  });
}

export async function questionToSql(question) {
  // primary model first, then fallbacks; retry briefly on temporary overload (503/429/500)
  const models = [process.env.GEMINI_MODEL || "gemini-3.8-flash", process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash"];
  let lastErr = "";
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await callModel(model, question);
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "{}";
        return JSON.parse(text.replace(/```json|```/g, "").trim());
      }
      lastErr = `LLM error ${res.status} (${model}): ${(await res.text()).slice(0, 160)}`;
      if (![429, 500, 503].includes(res.status)) throw new Error(lastErr);
      await sleep(1200 * (attempt + 1));
    }
  }
  throw new Error(`${lastErr} - the model is busy, please try again in a minute.`);
}