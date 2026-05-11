"use client";

import { useState } from "react";
import { WithHelp, CopyableCode, labelClass } from "../ui-helpers";

interface ComplexaCard {
  id: string;
  title: string;
  due_date: string | null;
  dueFormatted: string;
  assignees: string[];
  labels: string[];
  lastComment: string;
  lastCommentAuthor: string;
  lastCommentDate: string;
}

export function TabComplexa() {
  const [cards, setCards] = useState<ComplexaCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadCards = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/list-complexa");
      const data = await res.json();
      if (data.success) {
        setCards(data.cards);
      } else {
        setError(data.error || "Erro ao carregar");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  const formatCommentDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">Adequação Complexa — Fase 3</h2>
        <p className="text-sm text-gray-500 mb-4">
          Todos os cards da Fase 3 com tag &quot;Adequação Complexa&quot; e o último comentário.
        </p>
        <WithHelp help="Busca todos os cards da Fase 3 com tag Adequação Complexa, independente do vencimento">
          <button
            onClick={loadCards}
            disabled={loading}
            className="bg-gray-600 text-white px-6 py-3 rounded-md font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Carregando..." : `Carregar Cards${cards.length > 0 ? ` (${cards.length})` : ""}`}
          </button>
        </WithHelp>
        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
      </section>

      {cards.length > 0 && (
        <section className="space-y-3">
          {cards.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-lg shadow p-5 border-l-4 border-l-orange-500"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <CopyableCode code={c.title} className="text-base" />
                  <span className="text-xs text-gray-500 ml-3">
                    Vencimento: {c.dueFormatted}
                  </span>
                  {c.assignees.length > 0 && (
                    <span className="text-xs text-gray-400 ml-3">
                      {c.assignees.join(", ")}
                    </span>
                  )}
                </div>
              </div>
              {c.labels.length > 0 && (
                <div className="flex gap-1 mb-3">
                  {c.labels.map((l) => (
                    <span key={l} className={labelClass(l)}>
                      {l}
                    </span>
                  ))}
                </div>
              )}
              {c.lastComment ? (
                <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-gray-700">
                      {c.lastCommentAuthor}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {formatCommentDate(c.lastCommentDate)}
                    </span>
                  </div>
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">
                    {c.lastComment}
                  </pre>
                </div>
              ) : (
                <p className="text-xs text-gray-400">Sem comentários</p>
              )}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
