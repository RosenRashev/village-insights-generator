/**
 * Защита на диагностичните маршрути /api/diag/*: само за четене, с таен ключ DIAG_TOKEN.
 * Без зададен ключ маршрутите са изключени (404); грешен ключ дава 401.
 */
export type DiagAuth = "disabled" | "denied" | "ok";

/** Сравнение без ранно излизане (времето не издава докъде съвпада ключът). */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function checkDiagAuth(authorization: string | null, token: string | undefined): DiagAuth {
  if (!token || token.length < 16) return "disabled";
  const m = /^Bearer\s+(.+)$/i.exec(authorization ?? "");
  if (!m) return "denied";
  return safeEqual(m[1]!.trim(), token) ? "ok" : "denied";
}

export function diagDeniedResponse(status: DiagAuth): Response | null {
  if (status === "ok") return null;
  const code = status === "disabled" ? 404 : 401;
  return new Response(code === 404 ? "Not found" : "Unauthorized", {
    status: code,
    headers: { "cache-control": "no-store" },
  });
}

export function diagJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
