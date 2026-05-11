// Parsers compartilhados pra comentarios de cards Pipefy
// (formato: "❌ KEYWORD: ..." ou "✔️ KEYWORD: ...").

export function getSectionStatus(
  text: string,
  keyword: string
): "❌" | "✔️" | "" {
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      /^[❌✔✅]/.test(trimmed) &&
      trimmed.toUpperCase().includes(keyword.toUpperCase())
    ) {
      return trimmed.startsWith("❌") ? "❌" : "✔️";
    }
  }
  return "";
}
