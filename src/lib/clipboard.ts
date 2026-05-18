export async function copyHtmlWithFallback(html: string, plainText: string): Promise<void> {
  try {
    if (!document.hasFocus()) window.focus();
    const blob = new Blob([html], { type: "text/html" });
    const blobText = new Blob([plainText], { type: "text/plain" });
    await navigator.clipboard.write([new ClipboardItem({ "text/html": blob, "text/plain": blobText })]);
    return;
  } catch {
    const ta = document.createElement("div");
    ta.contentEditable = "true";
    ta.innerHTML = html;
    ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(ta);
    const range = document.createRange();
    range.selectNodeContents(ta);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    document.execCommand("copy");
    sel?.removeAllRanges();
    ta.remove();
  }
}
