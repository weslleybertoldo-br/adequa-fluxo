"use client";

import { useState } from "react";

export function TabSlackHistory() {
  const [messages, setMessages] = useState<
    { ts: string; text: string; date: string; botMessage: boolean }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/slack-history?limit=30");
      const data = await res.json();
      if (data.success) setMessages(data.messages);
    } catch {}
    setLoading(false);
  };

  const deleteMessage = async (ts: string) => {
    if (!confirm("Apagar esta mensagem do Slack?")) return;
    setDeleting(ts);
    try {
      const res = await fetch("/api/slack-history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ts }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => prev.filter((m) => m.ts !== ts));
      }
    } catch {}
    setDeleting(null);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <section className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Histórico Pedidos Slack</h2>
          <p className="text-sm text-gray-500">Mensagens do canal #despesas-implantação</p>
        </div>
        <button
          onClick={loadMessages}
          disabled={loading}
          className="bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Carregando..." : "Carregar Mensagens"}
        </button>
      </div>

      {messages.length > 0 && (
        <div className="space-y-1">
          {messages.map((m) => {
            const codeMatch =
              m.text.match(/imóvel\s+(\S+)/i) || m.text.match(/despesa\s*-\s*(\S+)/i);
            const code = codeMatch?.[1]?.replace(/[*_]/g, "") || "";
            const firstLine = m.text
              .split("\n")[0]
              .replace(/<@[^>]+>/g, "")
              .replace(/\*/g, "")
              .trim();
            const isFinished = m.text.includes("finalizado") || m.text.includes("✅");
            return (
              <div
                key={m.ts}
                className="flex items-center justify-between px-3 py-2 rounded-md border border-gray-200 bg-gray-50 gap-2"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-[10px] text-gray-400 flex-shrink-0">
                    {formatDate(m.date)}
                  </span>
                  {code && (
                    <span className="text-xs font-mono font-bold text-gray-800 flex-shrink-0">
                      {code}
                    </span>
                  )}
                  <span
                    className={`text-xs truncate ${
                      isFinished ? "text-green-600" : "text-gray-500"
                    }`}
                  >
                    {isFinished ? "✅ Finalizado" : firstLine.slice(0, 60)}
                  </span>
                </div>
                <button
                  onClick={() => deleteMessage(m.ts)}
                  disabled={deleting === m.ts}
                  className="flex-shrink-0 text-red-400 hover:text-red-600 disabled:opacity-50 text-[10px] px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors"
                >
                  {deleting === m.ts ? "..." : "✕"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {messages.length === 0 && !loading && (
        <p className="text-sm text-gray-400 text-center py-4">
          Clique em "Carregar Mensagens" para ver o histórico
        </p>
      )}
    </section>
  );
}
