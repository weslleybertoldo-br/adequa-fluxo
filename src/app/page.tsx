"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";

// =====================
// COMPONENTE: Tooltip expandível ao passar o mouse
// =====================

function WithHelp({ help, children, className }: { help: string; children: ReactNode; className?: string }) {
  const [showBtn, setShowBtn] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showBelow, setShowBelow] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Formata o texto: "~" separa linhas, "|" separa seções com linha divisória
  const formatHelp = (text: string) => {
    const sections = text.split("|");
    return sections.map((section, si) => {
      const lines = section.trim().split("~");
      return (
        <span key={si}>
          {si > 0 && <><br /><hr className="border-gray-700 my-1.5" /></>}
          {lines.map((line, li) => (
            <span key={li}>
              {li > 0 && <br />}
              {line.trim()}
            </span>
          ))}
        </span>
      );
    });
  };

  const handleExpand = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setShowBelow(rect.top < 300);
    }
    setExpanded(true);
  };

  return (
    <div
      ref={containerRef}
      className={`relative ${className || "inline-flex"}`}
      onMouseEnter={() => { if (hideTimeout.current) clearTimeout(hideTimeout.current); setShowBtn(true); setExpanded(false); }}
      onMouseLeave={() => { hideTimeout.current = setTimeout(() => { setShowBtn(false); setExpanded(false); }, 400); }}
    >
      {children}
      {showBtn && !expanded && (
        <button
          onClick={handleExpand}
          className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded shadow-lg z-[60] whitespace-nowrap cursor-pointer hover:bg-gray-700 transition-colors"
        >
          expandir
        </button>
      )}
      {expanded && (
        <div className={`absolute left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[11px] px-4 py-3 rounded-lg shadow-lg z-[60] w-[28rem] leading-relaxed ${showBelow ? "top-full mt-2" : "-top-2 -translate-y-full"}`}>
          {formatHelp(help)}
          <div className={`absolute left-1/2 -translate-x-1/2 rotate-45 w-2 h-2 bg-gray-900 ${showBelow ? "top-0 -translate-y-1/2" : "bottom-0 translate-y-1/2"}`} />
        </div>
      )}
    </div>
  );
}

// =====================
// COMPONENTE: Select com pesquisa
// =====================

function SearchableSelect({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = search
    ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
      <input
        type="text"
        value={open ? search : value || search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); if (!e.target.value) onChange(""); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder || "Selecione..."}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {value && !open && (
        <button onClick={() => { onChange(""); setSearch(""); setOpen(true); }} className="absolute right-2 top-8 text-gray-400 hover:text-gray-600 text-xs">
          limpar
        </button>
      )}
      {open && filtered.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((o) => (
            <button
              key={o}
              onClick={() => { onChange(o); setSearch(""); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${value === o ? "bg-blue-100 font-medium" : ""}`}
            >
              {o}
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && search && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-3 text-sm text-gray-500">
          Nenhum resultado
        </div>
      )}
    </div>
  );
}

// =====================
// COMPONENTE: Código copiável
// =====================

function CopyableCode({ code, className = "text-sm" }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span
      className={`font-mono font-bold ${className} cursor-pointer relative group`}
      onClick={() => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title="Clique para copiar"
    >
      {code}
      <span className={`ml-1.5 text-[10px] font-normal transition-opacity ${copied ? "text-green-600 opacity-100" : "text-gray-400 opacity-0 group-hover:opacity-100"}`}>
        {copied ? "copiado!" : "copiar"}
      </span>
    </span>
  );
}

// =====================
// TYPES
// =====================

interface CardResult {
  code: string;
  status: "pending" | "processing" | "success" | "error";
  message?: string;
  recordId?: string;
}

interface UpdateCardInfo {
  id: string;
  title: string;
  labels: string[];
  skip: boolean;
  skipReason: string;
  assignees: string[];
  due_date: string | null;
  lastComment?: string;
  lastCommentAuthor?: string;
  firstComment?: string;
  pipe1Phase?: string;
}

interface UpdateResult {
  cardId: string;
  title: string;
  action: "pending" | "processing" | "skipped" | "updated" | "error";
  details: string;
}

// =====================
// LOGIN SCREEN
// =====================

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        onLogin();
      } else {
        setError(data.error || "Email ou senha incorretos");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Pipefy Enxoval</h1>
        <p className="text-sm text-gray-500 mb-6">Faça login para acessar</p>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && document.getElementById("pwd")?.focus()}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          id="pwd"
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <WithHelp help="Faz login no sistema com email e senha para acessar o dashboard" className="relative w-full">
          <button
            onClick={handleLogin}
            disabled={loading || !email || !password}
            className="w-full bg-blue-600 text-white py-2.5 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </WithHelp>
      </div>
    </div>
  );
}

// =====================
// TAB: PROCESSAMENTO (cards da Fase 5 com registro de enxoval)
// =====================

interface PdfAttachment {
  fileName: string;
  path: string;
  url: string;
  createdAt: string | null;
}

interface EnxovalCard {
  id: string;
  title: string;
  hasRecord: boolean;
  recordId: string;
  attachments: PdfAttachment[];
  defaultPdf: { fileName: string; path: string } | null;
}

type ProcessMode = "anexo" | "vistoria";

type VistoriaCardOpt = {
  id: string;
  title: string;
  phaseName: string;
  responsavel: string | null;
  dataAgendamento: string | null;
  motivo: string | null;
  kits: Record<string, number>;
};

// Mapa cod → label dos ambientes/kits do PIPE 3 (espelha KITS em src/lib/enxoval/calc.ts)
const KIT_LABELS: Array<{ cod: string; label: string }> = [
  { cod: "0.1", label: "Cama Solteiro" },
  { cod: "0.2", label: "Cama Casal" },
  { cod: "0.3", label: "Cama Queen" },
  { cod: "0.4", label: "Cama King" },
  { cod: "0.5", label: "Sofá-cama solteiro" },
  { cod: "0.6", label: "Sofá-cama casal" },
  { cod: "0.7", label: "Banheiros" },
  { cod: "0.8", label: "Lavabos" },
  { cod: "0.9", label: "Jacuzzis/Banheira" },
  { cod: "0.10", label: "Cozinhas" },
  { cod: "0.11", label: "Toalha Maquiagem" },
];

type KitsLoad =
  | { status: "loading" }
  | { status: "ok"; kits: Record<string, number>; multiple: boolean; count: number }
  | { status: "empty" }
  | { status: "error"; message: string };

function TabProcessamento() {
  const [cards, setCards] = useState<EnxovalCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [processingCard, setProcessingCard] = useState<string | null>(null);
  const [processingAll, setProcessingAll] = useState(false);
  const abortRef = useRef(false);
  const [cardStatuses, setCardStatuses] = useState<Record<string, { status: "success" | "error"; message: string }>>({});
  const [summary, setSummary] = useState<{ total: number; withRecord: number; withoutRecord: number } | null>(null);
  const [deletingCard, setDeletingCard] = useState<string | null>(null);
  // Modal de seleção de vistoria
  const [vistoriaPicker, setVistoriaPicker] = useState<{
    code: string;
    cards: VistoriaCardOpt[];
  } | null>(null);
  // Por linha: modo selecionado e (no modo anexo) o path do PDF escolhido
  const [rowMode, setRowMode] = useState<Record<string, ProcessMode>>({});
  const [rowAttachment, setRowAttachment] = useState<Record<string, string>>({}); // code -> attachment.path
  // Cache de kits (configuracao do imovel) por codigo, lazy-loaded do PIPE 3
  const [kitsByCode, setKitsByCode] = useState<Record<string, KitsLoad>>({});
  // Conjunto de codigos ja em fetch — evita re-disparar quando setState refresca o effect
  const kitsInFlightRef = useRef<Set<string>>(new Set());

  const loadCards = async () => {
    setLoading(true);
    setError("");
    setCardStatuses({});
    try {
      const res = await fetch("/api/list-phase5-enxoval");
      const data = await res.json();
      if (data.success) {
        const list = data.cards as EnxovalCard[];
        setCards(list);
        setSummary({ total: data.totalCards, withRecord: data.withRecord, withoutRecord: data.withoutRecord });
        // Inicializa estado por card: se tem defaultPdf usa modo "anexo" + path; senão sem default
        const modeInit: Record<string, ProcessMode> = {};
        const attachInit: Record<string, string> = {};
        for (const c of list) {
          if (c.defaultPdf) {
            modeInit[c.title] = "anexo";
            attachInit[c.title] = c.defaultPdf.path;
          }
        }
        setRowMode(modeInit);
        setRowAttachment(attachInit);
      } else {
        setError(data.error || "Erro ao carregar cards");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  // Lazy-load kits do PIPE 3 pra cada card que ainda nao tem registro.
  // Evita chamada quando hasRecord (ja processado), ja em cache ou ja em flight.
  useEffect(() => {
    const inFlight = kitsInFlightRef.current;
    const pending = cards
      .filter((c) => !c.hasRecord && !kitsByCode[c.title] && !inFlight.has(c.title))
      .slice(0, 8); // throttle: max 8 paralelas por ciclo
    if (pending.length === 0) return;
    for (const c of pending) inFlight.add(c.title);
    setKitsByCode((prev) => {
      const next = { ...prev };
      for (const c of pending) next[c.title] = { status: "loading" };
      return next;
    });
    for (const c of pending) {
      const code = c.title;
      (async () => {
        try {
          const res = await fetch("/api/list-vistoria-cards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });
          const data = await res.json();
          let load: KitsLoad;
          if (!res.ok || !data.success) {
            load = { status: "error", message: data.error || `HTTP ${res.status}` };
          } else {
            const list = (data.cards as Array<{ id: string; kits: Record<string, number>; dataAgendamento: string | null }>) || [];
            // Ordena: mais recente primeiro (data desc, fallback id numerico desc)
            const sorted = [...list].sort((a, b) => {
              const da = a.dataAgendamento ? Date.parse(a.dataAgendamento) : NaN;
              const db = b.dataAgendamento ? Date.parse(b.dataAgendamento) : NaN;
              if (Number.isFinite(da) && Number.isFinite(db) && da !== db) return db - da;
              if (Number.isFinite(db) && !Number.isFinite(da)) return 1;
              if (Number.isFinite(da) && !Number.isFinite(db)) return -1;
              const ia = Number(a.id), ib = Number(b.id);
              if (Number.isFinite(ia) && Number.isFinite(ib)) return ib - ia;
              return 0;
            });
            load = sorted.length === 0
              ? { status: "empty" }
              : { status: "ok", kits: sorted[0].kits, multiple: sorted.length > 1, count: sorted.length };
          }
          setKitsByCode((prev) => ({ ...prev, [code]: load }));
        } catch (e) {
          setKitsByCode((prev) => ({
            ...prev,
            [code]: { status: "error", message: e instanceof Error ? e.message : String(e) },
          }));
        } finally {
          inFlight.delete(code);
        }
      })();
    }
  }, [cards, kitsByCode]);

  const generateEnxoval = async (
    code: string,
    opts: { vistoriaCardId?: string; attachment?: PdfAttachment } = {}
  ) => {
    setProcessingCard(code);
    try {
      const res = await fetch("/api/generate-enxoval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          vistoriaCardId: opts.vistoriaCardId,
          attachmentPath: opts.attachment?.path,
          attachmentUrl: opts.attachment?.url,
        }),
      });
      const data = await res.json();
      if (res.status === 409 && data.error === "MULTIPLE_VISTORIAS") {
        setProcessingCard(null);
        setVistoriaPicker({ code, cards: data.cards as VistoriaCardOpt[] });
        return;
      }
      if (data.success) {
        setCardStatuses((prev) => ({ ...prev, [code]: { status: "success", message: `Registro #${data.recordId} criado` } }));
        setCards((prev) => prev.map((c) => c.title === code ? { ...c, hasRecord: true, recordId: data.recordId } : c));
      } else {
        setCardStatuses((prev) => ({ ...prev, [code]: { status: "error", message: data.error || "Erro" } }));
      }
    } catch {
      setCardStatuses((prev) => ({ ...prev, [code]: { status: "error", message: "Erro de conexão" } }));
    } finally {
      setProcessingCard(null);
    }
  };

  const runRow = (c: EnxovalCard) => {
    const mode = rowMode[c.title];
    if (!mode) {
      setCardStatuses((prev) => ({
        ...prev,
        [c.title]: { status: "error", message: "Escolha um modo abaixo (anexo ou vistoria)" },
      }));
      return;
    }
    if (mode === "vistoria") {
      generateEnxoval(c.title);
    } else {
      const path = rowAttachment[c.title];
      const att = c.attachments.find((a) => a.path === path);
      if (!att) {
        setCardStatuses((prev) => ({ ...prev, [c.title]: { status: "error", message: "Escolha o PDF anexado" } }));
        return;
      }
      generateEnxoval(c.title, { attachment: att });
    }
  };

  const deleteRegistro = async (code: string, recordId: string, skipConfirm = false) => {
    if (!skipConfirm && !confirm(`Excluir o registro de enxoval do imóvel ${code}? Esta ação remove o registro da tabela e desconecta o PDF anexado.`)) return;
    setDeletingCard(code);
    try {
      const res = await fetch("/api/delete-registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, recordId }),
      });
      const data = await res.json();
      if (data.success) {
        setCardStatuses((prev) => ({ ...prev, [code]: { status: "success", message: "Registro excluído" } }));
        setCards((prev) => prev.map((c) => c.title === code ? { ...c, hasRecord: false, recordId: "" } : c));
      } else {
        setCardStatuses((prev) => ({ ...prev, [code]: { status: "error", message: data.error || "Erro ao excluir" } }));
      }
    } catch {
      setCardStatuses((prev) => ({ ...prev, [code]: { status: "error", message: "Erro de conexão" } }));
    } finally {
      setDeletingCard(null);
    }
  };

  const [deletingAll, setDeletingAll] = useState(false);
  const deleteAllRecords = async () => {
    const toDelete = cards.filter((c) => c.hasRecord && !!c.recordId);
    if (toDelete.length === 0) return;
    if (!confirm(`Excluir TODOS os ${toDelete.length} registros de enxoval listados? Esta ação remove cada registro da tabela e desconecta do card. Não pode ser desfeito.`)) return;
    abortRef.current = false;
    setDeletingAll(true);
    for (const c of toDelete) {
      if (abortRef.current) break;
      await deleteRegistro(c.title, c.recordId, true);
    }
    setDeletingAll(false);
  };

  const processAllCards = async () => {
    const toProcess = cards.filter((c) => !c.hasRecord && !cardStatuses[c.title]);
    if (toProcess.length === 0) return;
    abortRef.current = false;
    setProcessingAll(true);
    for (const card of toProcess) {
      if (abortRef.current) break;
      const mode = rowMode[card.title];
      if (mode === "anexo") {
        const path = rowAttachment[card.title];
        const att = card.attachments.find((a) => a.path === path);
        if (att) await generateEnxoval(card.title, { attachment: att });
        else setCardStatuses((prev) => ({ ...prev, [card.title]: { status: "error", message: "Escolha o PDF anexado" } }));
      } else if (mode === "vistoria") {
        await generateEnxoval(card.title);
      } else {
        setCardStatuses((prev) => ({
          ...prev,
          [card.title]: { status: "error", message: "Escolha um modo (anexo/vistoria) antes" },
        }));
      }
    }
    setProcessingAll(false);
  };

  const withoutRecord = cards.filter((c) => !c.hasRecord && !cardStatuses[c.title]).length;

  return (
    <>
      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">Registro de Enxoval — Fase 5</h2>
        <p className="text-sm text-gray-500 mb-4">
          Lista os cards da Fase 5. Por linha você escolhe o modo: <b>Usar PDF anexado</b> (lê o PDF do card e extrai quantidades) ou <b>Gerar do card de Vistorias</b> (calcula tudo do PIPE 3 e gera PDF idêntico à planilha). Se o card já tiver um anexo &quot;enxoval Geral&quot; ele já vem pré-selecionado.
        </p>
        <div className="flex gap-3">
          <WithHelp help="Busca todos os cards da Fase 5 e mostra quais já possuem registro de enxoval">
            <button
              onClick={loadCards}
              disabled={loading || processingAll}
              className="bg-gray-600 text-white px-6 py-3 rounded-md font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Carregando..." : `Carregar Cards${cards.length > 0 ? ` (${cards.length})` : ""}`}
            </button>
          </WithHelp>
          {cards.length > 0 && withoutRecord > 0 && (
            <WithHelp help="Cria registro de enxoval para todos os cards sem registro, processando um por um">
              <button
                onClick={processAllCards}
                disabled={processingAll || processingCard !== null || loading}
                className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {processingAll ? "Gerando..." : `Gerar Todos (${withoutRecord})`}
              </button>
            </WithHelp>
          )}
          {cards.length > 0 && cards.some((c) => c.hasRecord) && (
            <WithHelp help="Exclui TODOS os registros listados (apenas os cards que têm registro). Confirma 1× e processa em lote.">
              <button
                onClick={deleteAllRecords}
                disabled={deletingAll || processingAll || processingCard !== null || deletingCard !== null}
                className="bg-red-700 text-white px-6 py-3 rounded-md font-medium hover:bg-red-800 disabled:opacity-50 transition-colors"
              >
                {deletingAll ? "Excluindo todos..." : `Excluir Todos (${cards.filter((c) => c.hasRecord).length})`}
              </button>
            </WithHelp>
          )}
          {(processingAll || deletingAll) && (
            <WithHelp help="Interrompe o processamento em lote">
              <button
                onClick={() => { abortRef.current = true; }}
                className="bg-red-500 text-white px-6 py-3 rounded-md font-medium hover:bg-red-600 transition-colors"
              >
                Parar
              </button>
            </WithHelp>
          )}
        </div>
        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
      </section>

      {/* Resumo */}
      {summary && (
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
              <div className="text-xs text-gray-500">Total</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{summary.withoutRecord}</div>
              <div className="text-xs text-gray-500">Sem registro</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{summary.withRecord}</div>
              <div className="text-xs text-gray-500">Com registro</div>
            </div>
          </div>
        </section>
      )}

      {/* Lista de cards */}
      {cards.length > 0 && (
        <section className="space-y-2">
          {cards.map((c) => {
            const cardStatus = cardStatuses[c.title];
            const isProcessing = processingCard === c.title;
            const mode = rowMode[c.title];
            const selectedAttachment = rowAttachment[c.title] || "";
            const hasAttachments = c.attachments && c.attachments.length > 0;
            return (
              <div key={c.id} className={`px-4 py-3 rounded-md border ${
                cardStatus?.status === "success" ? "bg-green-50 border-green-200" :
                cardStatus?.status === "error" ? "bg-red-50 border-red-200" :
                c.hasRecord ? "bg-green-50/50 border-green-100" : "bg-white border-gray-200"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {cardStatus?.status === "success" ? "✅" :
                       cardStatus?.status === "error" ? "❌" :
                       isProcessing ? <span className="inline-block animate-spin">⏳</span> :
                       c.hasRecord ? "📋" : "⚠️"}
                    </span>
                    <div>
                      <CopyableCode code={c.title} className="text-sm" />
                      {c.hasRecord && (
                        <span className="text-xs text-green-600 ml-2">Registro #{c.recordId}</span>
                      )}
                      {!c.hasRecord && !cardStatus && (
                        <span className="text-xs text-red-500 ml-2">Sem registro</span>
                      )}
                      {!c.hasRecord && !cardStatus && (() => {
                        const kl = kitsByCode[c.title];
                        if (kl?.status === "ok" && kl.multiple) {
                          return (
                            <span className="text-xs text-amber-600 ml-2" title="Mais de uma vistoria — usando a mais recente">
                              ⚠️ {kl.count} vistorias (usando a mais recente)
                            </span>
                          );
                        }
                        return null;
                      })()}
                      {cardStatus && (
                        <span className={`text-xs ml-2 ${cardStatus.status === "success" ? "text-green-600" : "text-red-600"}`}>
                          {cardStatus.message}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <WithHelp help="Executa o modo selecionado abaixo: 'Usar PDF anexado' (lê o PDF escolhido no dropdown e cria registro) ou 'Gerar do card de Vistorias' (calcula tudo automaticamente do PIPE 3 e gera o PDF idêntico ao da planilha).">
                      <button
                        onClick={() => runRow(c)}
                        disabled={isProcessing || processingCard !== null || deletingCard !== null || (c.hasRecord && !cardStatus)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                          c.hasRecord && !cardStatus
                            ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                            : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        }`}
                      >
                        {isProcessing ? "Processando..." : c.hasRecord && !cardStatus ? "Já registrado" : "Gerar Registro"}
                      </button>
                    </WithHelp>
                    {c.hasRecord && (
                      <WithHelp help="1. Desconecta o registro de enxoval do card~2. Apaga o registro da tabela">
                        <button
                          onClick={() => deleteRegistro(c.title, c.recordId)}
                          disabled={deletingCard === c.title || processingCard !== null || processingAll}
                          className="px-3 py-2 rounded-md text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          {deletingCard === c.title ? "Excluindo..." : "Excluir"}
                        </button>
                      </WithHelp>
                    )}
                  </div>
                </div>

                {/* Configuração do imóvel + Modos de processamento — lado a lado */}
                {!c.hasRecord && !cardStatus?.status && (() => {
                  const kload = kitsByCode[c.title];
                  const renderConfig = () => {
                    if (!kload) return null;
                    if (kload.status === "loading") {
                      return <div className="text-xs text-gray-400">Carregando configuração…</div>;
                    }
                    if (kload.status === "empty") {
                      return <div className="text-xs text-amber-600">Sem card de Vistoria no PIPE 3 para esse código.</div>;
                    }
                    if (kload.status === "error") {
                      return <div className="text-xs text-red-500">Falha ao buscar configuração: {kload.message}</div>;
                    }
                    const items = KIT_LABELS.map((k) => ({ ...k, qty: kload.kits[k.cod] ?? 0 })).filter((k) => k.qty > 0);
                    if (items.length === 0) {
                      return <div className="text-xs text-amber-600">Configuração vazia no card de Vistoria.</div>;
                    }
                    return (
                      <div className="text-xs text-gray-600">
                        <div className="font-medium text-gray-500 mb-0.5">
                          Configuração do imóvel:
                        </div>
                        <ul className="flex flex-col gap-0.5">
                          {items.map((k) => (
                            <li key={k.cod}>
                              <span>{k.label}</span>
                              <span className="ml-2 font-mono tabular-nums">{k.qty}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  };
                  return (
                    <div className="mt-2 pl-9 flex flex-row gap-6 items-start">
                      <div className="flex-1 min-w-0">{renderConfig()}</div>
                      <div className="flex flex-col gap-1.5 text-sm">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`mode-${c.id}`}
                            checked={mode === "anexo"}
                            disabled={!hasAttachments}
                            onChange={() => setRowMode((p) => ({ ...p, [c.title]: "anexo" }))}
                          />
                          <span className={hasAttachments ? "" : "text-gray-400"}>Usar PDF anexado</span>
                          <select
                            value={selectedAttachment}
                            onChange={(e) => {
                              setRowAttachment((p) => ({ ...p, [c.title]: e.target.value }));
                              setRowMode((p) => ({ ...p, [c.title]: "anexo" }));
                            }}
                            disabled={!hasAttachments || mode !== "anexo"}
                            className="text-xs px-2 py-1 border rounded bg-white disabled:bg-gray-100 disabled:text-gray-400 max-w-xs"
                          >
                            {!hasAttachments && <option value="">Sem anexos PDF</option>}
                            {hasAttachments && <option value="">— selecione —</option>}
                            {c.attachments.map((a) => (
                              <option key={a.path} value={a.path}>
                                {a.fileName}
                                {c.defaultPdf?.path === a.path ? " ★" : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`mode-${c.id}`}
                            checked={mode === "vistoria"}
                            onChange={() => setRowMode((p) => ({ ...p, [c.title]: "vistoria" }))}
                          />
                          <span>Gerar do card de Vistorias (PIPE 3)</span>
                        </label>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </section>
      )}

      {/* Modal seletor de vistoria */}
      {vistoriaPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Múltiplas vistorias para {vistoriaPicker.code}</h3>
              <p className="text-sm text-gray-500 mt-1">Escolha qual usar como referência para gerar o registro de enxoval.</p>
            </div>
            <div className="p-4 space-y-2">
              {vistoriaPicker.cards.map((v) => {
                const totalKits = Object.values(v.kits).reduce((s, n) => s + n, 0);
                return (
                  <button
                    key={v.id}
                    onClick={() => {
                      const code = vistoriaPicker.code;
                      const id = v.id;
                      setVistoriaPicker(null);
                      // Preserva o modo "anexo" + PDF escolhido na linha:
                      // sem isso, ao escolher a vistoria o backend gera um PDF novo
                      // em vez de reusar o anexo que o usuário selecionou.
                      const mode = rowMode[code];
                      if (mode === "anexo") {
                        const card = cards.find((c) => c.title === code);
                        const path = rowAttachment[code];
                        const att = card?.attachments.find((a) => a.path === path);
                        if (att) {
                          generateEnxoval(code, { vistoriaCardId: id, attachment: att });
                          return;
                        }
                      }
                      generateEnxoval(code, { vistoriaCardId: id });
                    }}
                    className="w-full text-left px-4 py-3 border rounded-md hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{v.phaseName} <span className="text-xs text-gray-500 ml-2">#{v.id}</span></div>
                        <div className="text-xs text-gray-600 mt-1">
                          {v.dataAgendamento && <>Agendamento: {v.dataAgendamento} · </>}
                          {v.motivo && <>Motivo: {v.motivo} · </>}
                          {v.responsavel && <>Resp: {v.responsavel}</>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-blue-700">{totalKits} kit(s)</div>
                        <div className="text-xs text-gray-500">
                          {Object.entries(v.kits).filter(([, n]) => n > 0).map(([k, n]) => `${k}×${n}`).join(" ")}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="px-6 py-3 border-t flex justify-end">
              <button
                onClick={() => setVistoriaPicker(null)}
                className="px-4 py-2 rounded-md text-sm bg-gray-100 hover:bg-gray-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// =====================
// TAB: ATUALIZAÇÃO DE CARDS
// =====================

const COPY_TEMPLATES: Record<string, (fup: string) => string> = {
  fase4: (fup) => `🟡 Imóvel em ativação\n\n🚨 Aguardando ativação do imóvel\n\n⏭️ Fup: ${fup}\n\n...................................................................................................`,
  fase5: (fup) => `✅ Imóvel ativo\n\n🚨 Aguardando o envio dos registros pendentes\n\n⏭️ Fup: ${fup}\n\n....................................................................................................`,
};

function CopyFupButton({ days, template = "fase4", extraDays = 0 }: { days: number; template?: string; extraDays?: number }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const totalDays = days + extraDays;
    const now = new Date();
    let added = 0;
    const next = new Date(now);
    while (added < totalDays) {
      next.setDate(next.getDate() + 1);
      if (next.getDay() !== 0 && next.getDay() !== 6) added++;
    }
    const dd = String(next.getDate()).padStart(2, "0");
    const mm = String(next.getMonth() + 1).padStart(2, "0");

    const textFn = COPY_TEMPLATES[template] || COPY_TEMPLATES.fase4;
    const text = textFn(`${dd}/${mm}`);

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <WithHelp help="Copia texto padrão com FUP calculado para a área de transferência">
      <button
        onClick={handleCopy}
        className={`px-6 py-3 rounded-md font-medium transition-colors ${copied ? "bg-green-600 text-white" : "bg-yellow-500 text-white hover:bg-yellow-600"}`}
      >
        {copied ? "Copiado!" : "Copiar FUP"}
      </button>
    </WithHelp>
  );
}

function CopyCobrancaButtons({ cardTitle, lastComment }: { cardTitle: string; lastComment: string }) {
  const [copiedFirst, setCopiedFirst] = useState(false);
  const [copiedSecond, setCopiedSecond] = useState(false);
  const [copiedFinalizar, setCopiedFinalizar] = useState(false);
  const [copiedPendente, setCopiedPendente] = useState(false);
  const [copiedExcecao, setCopiedExcecao] = useState(false);
  const [copiedAgradecimento, setCopiedAgradecimento] = useState(false);
  const [loading, setLoading] = useState(false);
  const franquiaRef = useRef<string>("");
  const fetchedRef = useRef(false);

  const getGreeting = () => {
    const hours = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false });
    const h = parseInt(hours);
    return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  };


  const handleCopy = async (type: "first" | "second") => {
    setLoading(true);
    try {
      // Busca franquia apenas na primeira vez
      if (!fetchedRef.current) {
        try {
          const res = await fetch(`/api/get-franqueado?code=${encodeURIComponent(cardTitle.trim())}`);
          const data = await res.json();
          franquiaRef.current = data.franqueado || "";
        } catch { /* silencioso */ }
        fetchedRef.current = true;
      }

      const firstName = franquiaRef.current.split(" ")[0] || "";
      const greeting = getGreeting();
      const sections = parsePendingSectionsFromComment(lastComment);

      const messageIntro = type === "first"
        ? "Temos atualizações sobre os registros pendentes?"
        : "Consegue nos ajudar com as adequações pendentes?";

      let sectionsPlain = "";
      let sectionsHtml = "";

      for (const section of sections) {
        sectionsPlain += `\n\n${section.name}:\n${section.items.join("\n")}`;
        sectionsHtml += `<br><p><b>${section.name}:</b><br>${section.items.join("<br>")}</p>`;
      }

      const plainText = `${greeting} ${firstName} :D\n\n${messageIntro}${sectionsPlain}`;
      const html = `<p>${greeting} ${firstName} :D</p><br><p>${messageIntro}</p>${sectionsHtml}`;

      const blob = new Blob([html], { type: "text/html" });
      const blobText = new Blob([plainText], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": blob, "text/plain": blobText }),
      ]);

      if (type === "first") {
        setCopiedFirst(true);
        setTimeout(() => setCopiedFirst(false), 2000);
      } else {
        setCopiedSecond(true);
        setTimeout(() => setCopiedSecond(false), 2000);
      }
    } catch (err) {
      console.error("Erro ao copiar cobrança:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-1">
      <button
        onClick={() => handleCopy("first")}
        disabled={loading}
        className={`px-3 py-1 rounded text-[10px] font-medium transition-colors ${copiedFirst ? "bg-green-500 text-white" : "bg-gray-300 text-gray-700 hover:bg-gray-400"} disabled:opacity-50`}
      >
        {loading && !copiedFirst ? "..." : copiedFirst ? "Copiado!" : "Primeira cobrança"}
      </button>
      <button
        onClick={async () => {
          setLoading(true);
          try {
            if (!fetchedRef.current) {
              try {
                const res = await fetch(`/api/get-franqueado?code=${encodeURIComponent(cardTitle.trim())}`);
                const data = await res.json();
                franquiaRef.current = data.franqueado || "";
              } catch { /* silencioso */ }
              fetchedRef.current = true;
            }
            const firstName = franquiaRef.current.split(" ")[0] || "";
            const sections = parsePendingSectionsFromComment(lastComment);

            let sectionsPlain = "";
            let sectionsHtml = "";

            for (const section of sections) {
              sectionsPlain += `\n\n${section.name}:\n${section.items.join("\n")}`;
              sectionsHtml += `<br><p><b>${section.name}:</b><br>${section.items.join("<br>")}</p>`;
            }

            const plainText = `Show ${firstName} :D\n\nMuito obrigado pelo envio dos registros, ficamos pendentes os registros abaixo. Saberia informar se temos previsão para finalizar as pendencias?${sectionsPlain}`;
            const html = `<p>Show ${firstName} :D</p><br><p>Muito obrigado pelo envio dos registros, ficamos pendentes os registros abaixo. Saberia informar se temos previsão para finalizar as pendencias?</p>${sectionsHtml}`;

            const blob = new Blob([html], { type: "text/html" });
            const blobText = new Blob([plainText], { type: "text/plain" });
            await navigator.clipboard.write([new ClipboardItem({ "text/html": blob, "text/plain": blobText })]);
            setCopiedAgradecimento(true);
            setTimeout(() => setCopiedAgradecimento(false), 2000);
          } catch (err) {
            console.error("Erro ao copiar agradecimento:", err);
          } finally {
            setLoading(false);
          }
        }}
        disabled={loading}
        className={`px-3 py-1 rounded text-[10px] font-medium transition-colors ${copiedAgradecimento ? "bg-green-500 text-white" : "bg-gray-300 text-gray-700 hover:bg-gray-400"} disabled:opacity-50`}
      >
        {loading && !copiedAgradecimento ? "..." : copiedAgradecimento ? "Copiado!" : "Obrigado: faltou itens"}
      </button>
          <button
        onClick={() => handleCopy("second")}
        disabled={loading}
        className={`px-3 py-1 rounded text-[10px] font-medium transition-colors ${copiedSecond ? "bg-green-500 text-white" : "bg-gray-300 text-gray-700 hover:bg-gray-400"} disabled:opacity-50`}
      >
        {loading && !copiedSecond ? "..." : copiedSecond ? "Copiado!" : "Segunda cobrança"}
      </button>
      <button
        onClick={async () => {
          setLoading(true);
          try {
            if (!fetchedRef.current) {
              try {
                const res = await fetch(`/api/get-franqueado?code=${encodeURIComponent(cardTitle.trim())}`);
                const data = await res.json();
                franquiaRef.current = data.franqueado || "";
              } catch { /* silencioso */ }
              fetchedRef.current = true;
            }
            const firstName = franquiaRef.current.split(" ")[0] || "";
            const greet = getGreeting();
            const plainText = `${greet} ${firstName} :D\n\n\n\nFicamos pendentes somente a entrega do enxoval!`;
            const html = `<p>${greet} ${firstName} :D</p><br><br><br><p>Ficamos pendentes somente a entrega do enxoval!</p>`;
            const blob = new Blob([html], { type: "text/html" });
            const blobText = new Blob([plainText], { type: "text/plain" });
            await navigator.clipboard.write([new ClipboardItem({ "text/html": blob, "text/plain": blobText })]);
            setCopiedPendente(true);
            setTimeout(() => setCopiedPendente(false), 2000);
          } catch (err) {
            console.error("Erro ao copiar pendente enxoval:", err);
          } finally {
            setLoading(false);
          }
        }}
        disabled={loading}
        className={`px-3 py-1 rounded text-[10px] font-medium transition-colors ${copiedPendente ? "bg-green-500 text-white" : "bg-gray-300 text-gray-700 hover:bg-gray-400"} disabled:opacity-50`}
      >
        {loading && !copiedPendente ? "..." : copiedPendente ? "Copiado!" : "Pendente enxoval"}
      </button>
      <button
        onClick={async () => {
          setLoading(true);
          try {
            if (!fetchedRef.current) {
              try {
                const res = await fetch(`/api/get-franqueado?code=${encodeURIComponent(cardTitle.trim())}`);
                const data = await res.json();
                franquiaRef.current = data.franqueado || "";
              } catch { /* silencioso */ }
              fetchedRef.current = true;
            }
            const firstName = franquiaRef.current.split(" ")[0] || "";
            const plainText = `Olá ${firstName},\n\n\nTodas as pendências desta unidade foram finalizadas.\n\n\nCom isso, finalizamos a implantação deste imóvel!\n\n\nMuito obrigado por toda colaboração e boas reservas!`;
            const html = `<p>Olá ${firstName},</p><br><br><p>Todas as pendências desta unidade foram finalizadas.</p><br><br><p>Com isso, finalizamos a implantação deste imóvel!</p><br><br><p>Muito obrigado por toda colaboração e boas reservas!</p>`;
            const blob = new Blob([html], { type: "text/html" });
            const blobText = new Blob([plainText], { type: "text/plain" });
            await navigator.clipboard.write([new ClipboardItem({ "text/html": blob, "text/plain": blobText })]);
            setCopiedFinalizar(true);
            setTimeout(() => setCopiedFinalizar(false), 2000);
          } catch (err) {
            console.error("Erro ao copiar finalizar sults:", err);
          } finally {
            setLoading(false);
          }
        }}
        disabled={loading}
        className={`px-3 py-1 rounded text-[10px] font-medium transition-colors ${copiedFinalizar ? "bg-green-500 text-white" : "bg-gray-300 text-gray-700 hover:bg-gray-400"} disabled:opacity-50`}
      >
        {loading && !copiedFinalizar ? "..." : copiedFinalizar ? "Copiado!" : "Finalizar Sults"}
      </button>
      <button
        onClick={async () => {
          setLoading(true);
          try {
            if (!fetchedRef.current) {
              try {
                const res = await fetch(`/api/get-franqueado?code=${encodeURIComponent(cardTitle.trim())}`);
                const data = await res.json();
                franquiaRef.current = data.franqueado || "";
              } catch { /* silencioso */ }
              fetchedRef.current = true;
            }
            const firstName = franquiaRef.current.split(" ")[0] || "";
            const greet = getGreeting();
            const plainText = `${greet} ${firstName} :D\n\n\nNosso time validou e seguiremos com exceção das pendências restantes.`;
            const html = `<p>${greet} ${firstName} :D</p><br><br><p>Nosso time validou e seguiremos com exceção das pendências restantes.</p>`;
            const blob = new Blob([html], { type: "text/html" });
            const blobText = new Blob([plainText], { type: "text/plain" });
            await navigator.clipboard.write([new ClipboardItem({ "text/html": blob, "text/plain": blobText })]);
            setCopiedExcecao(true);
            setTimeout(() => setCopiedExcecao(false), 2000);
          } catch (err) {
            console.error("Erro ao copiar exceção:", err);
          } finally {
            setLoading(false);
          }
        }}
        disabled={loading}
        className={`px-3 py-1 rounded text-[10px] font-medium transition-colors ${copiedExcecao ? "bg-green-500 text-white" : "bg-gray-300 text-gray-700 hover:bg-gray-400"} disabled:opacity-50`}
      >
        {loading && !copiedExcecao ? "..." : copiedExcecao ? "Copiado!" : "Exceção pendências"}
      </button>
    </div>
  );
}

function parsePendingSectionsFromComment(comment: string) {
  const lines = comment.split("\n");
  const sectionDefs = [
    { keyword: "ITENS", label: "ITENS MÍNIMOS" },
    { keyword: "MANUTEN", label: "MANUTENÇÃO" },
    { keyword: "ENXOVAL", label: "ENXOVAL" },
  ];
  const sections: { name: string; items: string[] }[] = [];

  for (const { keyword, label } of sectionDefs) {
    let startIdx = -1;
    let status = "";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if ((line.match(/^[❌✔✅]/) || line.startsWith("✔️")) && line.toUpperCase().includes(keyword.toUpperCase())) {
        startIdx = i;
        status = line.startsWith("❌") ? "❌" : "✔️";
        break;
      }
    }
    if (startIdx === -1 || status !== "❌") continue;

    if (keyword === "ENXOVAL") {
      sections.push({ name: label, items: ["(CONFIRMAÇÃO) Entrega e validação do enxoval."] });
      continue;
    }

    const contentLines: string[] = [];
    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.match(/^[❌✔✅]\s*(ENXOVAL|ITENS|MANUTENÇÃO|MANUTEN|INTERNET|PIN)/i) ||
          line.match(/^✔️\s*(ENXOVAL|ITENS|MANUTENÇÃO|MANUTEN|INTERNET|PIN)/i)) break;
      contentLines.push(line);
    }

    const pending: string[] = [];
    for (const line of contentLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/^[✅✔]/.test(trimmed) || trimmed.startsWith("✔️")) continue;
      const semiIdx = trimmed.indexOf(";");
      if (semiIdx >= 0) {
        const afterSemi = trimmed.slice(semiIdx + 1).trim();
        if (afterSemi.length > 0) continue;
      }
      pending.push(trimmed);
    }

    if (pending.length > 0) {
      sections.push({ name: label, items: pending });
    }
  }
  return sections;
}

function CopyScriptEsqueleto({ cardTitle, lastComment }: { cardTitle?: string; lastComment?: string }) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const franquiaRef = useRef<string>("");
  const fetchedRef = useRef<string>("");

  const handleCopy = async () => {
    setLoading(true);
    try {
      if (cardTitle && fetchedRef.current !== cardTitle) {
        try {
          const res = await fetch(`/api/get-franqueado?code=${encodeURIComponent(cardTitle.trim())}`);
          const data = await res.json();
          franquiaRef.current = data.franqueado || "";
        } catch { /* silencioso */ }
        fetchedRef.current = cardTitle;
      }

      const sections = lastComment ? parsePendingSectionsFromComment(lastComment) : [];
      const sectionLines = ["ENXOVAL", "ITENS MÍNIMOS", "MANUTENÇÃO"].map((name) => {
        const found = sections.find((s) => s.name === name);
        return found ? `❌ ${name}\n${found.items.join("\n")}` : `✔️ ${name}`;
      });

      // Calcular FUP +3 dias úteis a partir de hoje (horário de Brasília)
      const now = new Date();
      const brDateStr = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const fupDate = new Date(brDateStr + "T12:00:00");
      let added = 0;
      while (added < 3) {
        fupDate.setDate(fupDate.getDate() + 1);
        const dow = fupDate.getDay();
        if (dow !== 0 && dow !== 6) added++;
      }
      const fupStr = `${String(fupDate.getDate()).padStart(2, "0")}/${String(fupDate.getMonth() + 1).padStart(2, "0")}`;

      const text = `✅ Imóvel ativo

🚨 Aguardando o envio dos registros pendentes

⏭️ Fup: ${fupStr}

....................................................................................................

${sectionLines.join("\n\n")}

✔️ INTERNET

✔️PIN`;

      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCopy}
      disabled={loading}
      className={`px-3 py-1 rounded text-[10px] font-medium transition-colors ${copied ? "bg-green-500 text-white" : "bg-gray-300 text-gray-700 hover:bg-gray-400"} disabled:opacity-50`}
    >
      {loading ? "..." : copied ? "Copiado!" : "Esqueleto"}
    </button>
  );
}

function CopyScriptUnicoItem() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = `Vi que ainda ficou um item pendente para finalizarmos as adequações desse imóvel, consegue nos ajudar com o envio do registro? :D`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className={`px-3 py-1 rounded text-[10px] font-medium transition-colors ${copied ? "bg-green-500 text-white" : "bg-gray-300 text-gray-700 hover:bg-gray-400"}`}
    >
      {copied ? "Copiado!" : "Único item"}
    </button>
  );
}

function CopyScriptPendencias({ cardTitle, lastComment }: { cardTitle?: string; lastComment?: string }) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const franquiaRef = useRef<string>("");
  const fetchedRef = useRef<string>("");

  const handleCopy = async () => {
    setLoading(true);
    try {
      if (cardTitle && fetchedRef.current !== cardTitle) {
        try {
          const res = await fetch(`/api/get-franqueado?code=${encodeURIComponent(cardTitle.trim())}`);
          const data = await res.json();
          franquiaRef.current = data.franqueado || "";
        } catch { /* silencioso */ }
        fetchedRef.current = cardTitle;
      }

      const firstName = franquiaRef.current.split(" ")[0] || "";
      const greeting = (() => {
        const h = parseInt(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }));
        return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
      })();

      const sections = lastComment ? parsePendingSectionsFromComment(lastComment) : [];

      // Contar total de itens pendentes: cada seção ❌ conta seus itens (ENXOVAL = 1 fixo)
      const totalPendingItems = sections.reduce((acc, s) => acc + s.items.length, 0);
      const isSingular = totalPendingItems <= 1;

      const messageIntro = isSingular
        ? "Vi que ainda ficou um item pendente para finalizarmos as adequações desse imóvel, consegue nos ajudar com o envio do registro? :D"
        : "Vi que ainda ficaram alguns itens pendente para finalizarmos as adequações desse imóvel, consegue nos ajudar com o envio desses registros? :D";

      let sectionsPlain = "";
      let sectionsHtml = "";

      if (sections.length > 0) {
        for (const section of sections) {
          sectionsPlain += `\n\n${section.name}:\n${section.items.join("\n")}`;
          sectionsHtml += `<br><p><b>${section.name}:</b><br>${section.items.join("<br>")}</p>`;
        }
      } else {
        sectionsPlain = "\n\nITENS MÍNIMOS:\nTábua de corte;\n\nMANUTENÇÃO:\nFerro de passar;\n\nENXOVAL:\n(CONFIRMAÇÃO) Entrega e validação do enxoval.";
        sectionsHtml = `<br><p><b>ITENS MÍNIMOS:</b><br>Tábua de corte;</p><br><p><b>MANUTENÇÃO:</b><br>Ferro de passar;</p><br><p><b>ENXOVAL:</b><br>(CONFIRMAÇÃO) Entrega e validação do enxoval.</p>`;
      }

      const plainText = `${greeting} ${firstName} :D\n\n${messageIntro}\n\nREGISTROS PENDENTES${sectionsPlain}`;

      const html = `<p>${greeting} ${firstName} :D</p><br><p>${messageIntro}</p><br><p><b>REGISTROS PENDENTES</b></p>${sectionsHtml}`;

      const blob = new Blob([html], { type: "text/html" });
      const blobText = new Blob([plainText], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": blob, "text/plain": blobText }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <WithHelp help="Copia texto de cobrança de pendências com nome da franquia e pendências reais do card (Bom dia/Boa tarde/Boa noite automático)">
      <button
        onClick={handleCopy}
        disabled={loading}
        className={`px-6 py-3 rounded-md font-medium transition-colors ${copied ? "bg-green-600 text-white" : "bg-orange-500 text-white hover:bg-orange-600"} disabled:opacity-50`}
      >
        {loading ? "..." : copied ? "Copiado!" : "Script Pendências"}
      </button>
    </WithHelp>
  );
}

function CopyScriptSoEnxoval({ cardTitle }: { cardTitle?: string }) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const franquiaRef = useRef<string>("");
  const fetchedRef = useRef<string>("");

  const handleCopy = async () => {
    setLoading(true);
    try {
      if (cardTitle && fetchedRef.current !== cardTitle) {
        try {
          const res = await fetch(`/api/get-franqueado?code=${encodeURIComponent(cardTitle.trim())}`);
          const data = await res.json();
          franquiaRef.current = data.franqueado || "";
        } catch { /* silencioso */ }
        fetchedRef.current = cardTitle;
      }

      const firstName = franquiaRef.current.split(" ")[0] || "";
      const greeting = (() => {
        const h = parseInt(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }));
        return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
      })();

      const plainText = `${greeting} ${firstName} :D\n\n\nFicamos pendentes somente o enxoval desse imóvel.`;
      const html = `<p>${greeting} ${firstName} :D</p><br><br><p>Ficamos pendentes somente o enxoval desse imóvel.</p>`;
      const blob = new Blob([html], { type: "text/html" });
      const blobText = new Blob([plainText], { type: "text/plain" });
      await navigator.clipboard.write([new ClipboardItem({ "text/html": blob, "text/plain": blobText })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCopy}
      disabled={loading}
      className={`px-6 py-3 rounded-md font-medium transition-colors ${copied ? "bg-green-600 text-white" : "bg-purple-500 text-white hover:bg-purple-600"} disabled:opacity-50`}
    >
      {loading ? "..." : copied ? "Copiado!" : "Só enxoval"}
    </button>
  );
}

function TabUpdateCards({ apiRoute, phaseName, phaseDescription, showCopyButton }: { apiRoute: string; phaseName: string; phaseDescription: string; showCopyButton?: boolean }) {
  const [cards, setCards] = useState<UpdateCardInfo[]>([]);
  const [results, setResults] = useState<UpdateResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [phaseInfo, setPhaseInfo] = useState<{ totalCards: number; toUpdate: number; toSkip: number } | null>(null);
  const [error, setError] = useState("");
  const abortRef = useRef(false);
  const [searchCode, setSearchCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [extraDays, setExtraDays] = useState(0);
  const [extraDaysAtivos, setExtraDaysAtivos] = useState(0);
  const [editingManualCard, setEditingManualCard] = useState<string | null>(null);
  const [manualCommentText, setManualCommentText] = useState("");
  const [manualUpdating, setManualUpdating] = useState<string | null>(null);
  const [manualStatuses, setManualStatuses] = useState<Record<string, { status: "updated" | "error"; message: string }>>({});

  // Estados para Fase 4 Ativos
  const [ativosCards, setAtivosCards] = useState<{ id: string; title: string; due_date: string | null; dueFormatted: string; assignees: string[]; labels: string[]; pipe1Phase: string; lastComment: string; lastCommentAuthor: string; lastCommentDate: string }[]>([]);
  const [ativosLoading, setAtivosLoading] = useState(false);
  const [ativosUpdating, setAtivosUpdating] = useState<string | null>(null);
  const [ativosStatuses, setAtivosStatuses] = useState<Record<string, { status: "updated" | "error"; message: string }>>({});
  const [editingAtivo, setEditingAtivo] = useState<string | null>(null);
  const [ativoCommentText, setAtivoCommentText] = useState("");
  const [editingAtivoComment, setEditingAtivoComment] = useState<string | null>(null);
  const [ativoCommentOnlyText, setAtivoCommentOnlyText] = useState("");

  const openManualEditor = (cardId: string, firstComment: string) => {
    const days = 2 + extraDays;
    const now = new Date();
    let added = 0;
    const next = new Date(now);
    while (added < days) {
      next.setDate(next.getDate() + 1);
      if (next.getDay() !== 0 && next.getDay() !== 6) added++;
    }
    const dd = String(next.getDate()).padStart(2, "0");
    const mm = String(next.getMonth() + 1).padStart(2, "0");
    const fupDate = `${dd}/${mm}`;
    let updatedComment = firstComment || "";
    // Remove "- " do início dos itens pendentes
    updatedComment = updatedComment.replace(/^- /gm, "");
    // ❌ PIN → ✔️ PIN
    updatedComment = updatedComment.replace(/❌\s*PIN/g, "✔️ PIN");
    // Adicionar cabeçalho se não existir
    const header = `🟡 Imóvel em ativação\n\n🚨 Aguardando ativação do imóvel\n\n⏭️ Fup: ${fupDate}\n\n....................................................................................................\n\n`;
    if (!updatedComment.includes("⏭️")) {
      updatedComment = header + updatedComment;
    } else {
      updatedComment = updatedComment.replace(/⏭️\s*Fup:\s*\d{2}\/\d{2}/, `⏭️ Fup: ${fupDate}`);
    }
    setEditingManualCard(cardId);
    setManualCommentText(updatedComment);
  };

  const sendManualComment = async () => {
    if (!editingManualCard || !manualCommentText.trim()) return;
    const cardId = editingManualCard;
    setManualUpdating(cardId);
    try {
      const res = await fetch(apiRoute, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, extraDays, customComment: manualCommentText }),
      });
      const data = await res.json();
      if (data.success) {
        setManualStatuses((prev) => ({ ...prev, [cardId]: { status: "updated", message: data.details } }));
      } else {
        setManualStatuses((prev) => ({ ...prev, [cardId]: { status: "error", message: data.error || "Erro" } }));
      }
    } catch {
      setManualStatuses((prev) => ({ ...prev, [cardId]: { status: "error", message: "Erro de conexão" } }));
    } finally {
      setManualUpdating(null);
      setEditingManualCard(null);
    }
  };

  const loadAtivos = async () => {
    setAtivosLoading(true);
    setAtivosCards([]);
    setAtivosStatuses({});
    try {
      const res = await fetch("/api/update-cards-phase4-ativos");
      const data = await res.json();
      if (data.success) {
        setAtivosCards(data.cards);
      } else {
        setError(data.error || "Erro ao carregar ativos");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setAtivosLoading(false);
    }
  };

  const openAtivoEditor = (cardId: string) => {
    const card = ativosCards.find((c) => c.id === cardId);
    if (!card?.lastComment) return;

    const days = extraDaysAtivos === -99 ? 0 : 3 + extraDaysAtivos;
    const now = new Date();
    let added = 0;
    const next = new Date(now);
    while (added < days) {
      next.setDate(next.getDate() + 1);
      if (next.getDay() !== 0 && next.getDay() !== 6) added++;
    }
    const dd = String(next.getDate()).padStart(2, "0");
    const mm = String(next.getMonth() + 1).padStart(2, "0");
    const fupDate = `${dd}/${mm}`;

    // Gerar preview: texto acima do FUP + FUP novo + conteúdo abaixo dos "..."
    const lines = card.lastComment.split("\n");
    let separatorIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().match(/^\.{3,}/)) { separatorIdx = i; break; }
    }
    const belowSeparator = separatorIdx >= 0 ? lines.slice(separatorIdx).join("\n") : "";
    const preview = `✅ Imóvel ativo\n\n🚨 Aguardando o envio dos registros pendentes\n\n⏭️ Fup: ${fupDate}\n\n${belowSeparator}`;

    setEditingAtivo(cardId);
    setAtivoCommentText(preview);
  };

  const sendAtivoComment = async () => {
    if (!editingAtivo || !ativoCommentText.trim()) return;
    const cardId = editingAtivo;
    setAtivosUpdating(cardId);
    try {
      const res = await fetch("/api/update-cards-phase4-ativos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, customComment: ativoCommentText, extraDays: extraDaysAtivos }),
      });
      const data = await res.json();
      if (data.success && data.action === "updated") {
        setAtivosStatuses((prev) => ({ ...prev, [cardId]: { status: "updated", message: data.details } }));
      } else {
        setAtivosStatuses((prev) => ({ ...prev, [cardId]: { status: "error", message: data.error || data.details || "Erro" } }));
      }
    } catch {
      setAtivosStatuses((prev) => ({ ...prev, [cardId]: { status: "error", message: "Erro de conexão" } }));
    } finally {
      setAtivosUpdating(null);
      setEditingAtivo(null);
    }
  };

  const openAtivoCommentEditor = (cardId: string) => {
    const card = ativosCards.find((c) => c.id === cardId);
    if (!card?.lastComment) return;
    setEditingAtivoComment(cardId);
    setAtivoCommentOnlyText(card.lastComment);
  };

  const sendAtivoCommentOnly = async () => {
    if (!editingAtivoComment || !ativoCommentOnlyText.trim()) return;
    const cardId = editingAtivoComment;
    setAtivosUpdating(cardId);
    try {
      const res = await fetch("/api/update-cards-phase4-ativos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, action: "update_comment", commentText: ativoCommentOnlyText }),
      });
      const data = await res.json();
      if (data.success) {
        setAtivosStatuses((prev) => ({ ...prev, [cardId]: { status: "updated", message: "Comentário atualizado" } }));
      } else {
        setAtivosStatuses((prev) => ({ ...prev, [cardId]: { status: "error", message: data.error || data.details || "Erro" } }));
      }
    } catch {
      setAtivosStatuses((prev) => ({ ...prev, [cardId]: { status: "error", message: "Erro de conexão" } }));
    } finally {
      setAtivosUpdating(null);
      setEditingAtivoComment(null);
    }
  };

  const formatAtivosCommentDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm} ${hh}:${min}`;
  };

  const searchCard = async () => {
    if (!searchCode.trim()) return;
    setSearching(true);
    setError("");
    setResults([]);
    try {
      const res = await fetch(`${apiRoute}?search=${encodeURIComponent(searchCode.trim())}`);
      const data = await res.json();
      if (data.success) {
        setCards(data.cards);
        setPhaseInfo({ totalCards: data.totalCards, toUpdate: data.toUpdate, toSkip: data.toSkip });
      } else {
        setError(data.error || "Erro ao pesquisar");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setSearching(false);
    }
  };

  const loadCards = async () => {
    setLoading(true);
    setError("");
    setResults([]);
    try {
      const res = await fetch(apiRoute);
      const data = await res.json();
      if (data.success) {
        setCards(data.cards);
        setPhaseInfo({ totalCards: data.totalCards, toUpdate: data.toUpdate, toSkip: data.toSkip });
      } else {
        setError(data.error || "Erro ao carregar cards");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  // Processar cards um a um
  const processAll = async () => {
    const toProcess = cards.filter((c) => !c.skip);
    if (toProcess.length === 0) return;

    abortRef.current = false;
    setProcessing(true);

    // Iniciar todos como pending
    const initial: UpdateResult[] = toProcess.map((c) => ({
      cardId: c.id,
      title: c.title,
      action: "pending",
      details: "",
    }));
    setResults(initial);

    for (let i = 0; i < toProcess.length; i++) {
      if (abortRef.current) break;

      // Marcar como processing
      setResults((prev) => prev.map((r, idx) => (idx === i ? { ...r, action: "processing", details: "Processando..." } : r)));

      try {
        const res = await fetch(apiRoute, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId: toProcess[i].id, extraDays }),
        });
        const data = await res.json();

        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, action: data.action || "error", details: data.details || data.error || "Erro desconhecido" } : r
          )
        );
      } catch {
        setResults((prev) => prev.map((r, idx) => (idx === i ? { ...r, action: "error", details: "Erro de conexão" } : r)));
      }
    }
    setProcessing(false);
  };

  const updated = results.filter((r) => r.action === "updated").length;
  const errored = results.filter((r) => r.action === "error").length;
  const total = results.length;
  const progress = total > 0 ? ((updated + errored) / total) * 100 : 0;

  return (
    <>
      {/* Controles */}
      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">Atualização de Cards — {phaseName}</h2>
        <p className="text-sm text-gray-500 mb-4">{phaseDescription}</p>

        <div className="flex gap-3 mb-3">
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && searchCard()}
              placeholder="Pesquisar card..."
              className="border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
            />
            <WithHelp help="Pesquisa um card específico pelo código na fase, independente do vencimento">
              <button
                onClick={searchCard}
                disabled={searching || !searchCode.trim()}
                className="bg-blue-500 text-white px-4 py-2.5 rounded-md text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                {searching ? "Buscando..." : "Pesquisar"}
              </button>
            </WithHelp>
          </div>
        </div>

        <div className="flex gap-3 items-center flex-wrap">
          <WithHelp help="Busca os cards da fase com vencimento para hoje.~Cards com tags 'Adequação Complexa' ou 'Revisão de Pendências Finalizada' são ignorados">
            <button
              onClick={loadCards}
              disabled={loading || processing}
              className="bg-gray-600 text-white px-6 py-3 rounded-md font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Carregando..." : "Carregar Cards"}
            </button>
          </WithHelp>

          {cards.length > 0 && (
            <WithHelp help="Para cada card, executa:~1. Atualiza vencimento para próximo dia útil às 22:00~2. Muda responsável para Weslley (se não for)~3. Busca último comentário e substitui a data do FUP~4. Adiciona comentário atualizado no card~Processa um por um, sequencialmente">
              <button
                onClick={processAll}
                disabled={processing || loading}
                className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {processing ? "Processando..." : `Atualizar ${phaseInfo?.toUpdate || 0} Cards`}
              </button>
            </WithHelp>
          )}

          {processing && (
            <WithHelp help="Interrompe a atualização em lote dos cards">
              <button
                onClick={() => { abortRef.current = true; }}
                className="bg-red-500 text-white px-6 py-3 rounded-md font-medium hover:bg-red-600 transition-colors"
              >
                Parar
              </button>
            </WithHelp>
          )}

          <div className="flex flex-col gap-0.5 bg-gray-100 rounded-md px-2 py-1">
            {[1, 2, 3].map((d) => (
              <label key={d} className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={extraDays === d} onChange={() => setExtraDays(extraDays === d ? 0 : d)} className="w-3 h-3 accent-blue-600" />
                <span className="text-[10px] text-gray-600">+{d}</span>
              </label>
            ))}
          </div>

          {showCopyButton && <CopyFupButton days={2} extraDays={extraDays} />}

          {showCopyButton && (
            <>
              <WithHelp help="Busca cards da Fase 4 que já estão na Fase 10 do Pipe 1 (imóvel ativo). Mostra com opção de atualizar comentário e campos">
                <button
                  onClick={loadAtivos}
                  disabled={ativosLoading}
                  className="bg-green-600 text-white px-6 py-3 rounded-md font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {ativosLoading ? "Buscando..." : "Fase 4 Ativos"}
                </button>
              </WithHelp>
              <div className="flex flex-col gap-0.5 bg-gray-100 rounded-md px-2 py-1">
                {[1, 2, 3].map((d) => (
                  <label key={d} className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={extraDaysAtivos === d} onChange={() => setExtraDaysAtivos(extraDaysAtivos === d ? 0 : d)} className="w-3 h-3 accent-green-600" />
                    <span className="text-[10px] text-gray-600">+{d}</span>
                  </label>
                ))}
                <label className="flex items-center gap-1 cursor-pointer border-t border-gray-300 pt-0.5">
                  <input type="checkbox" checked={extraDaysAtivos === -99} onChange={() => setExtraDaysAtivos(extraDaysAtivos === -99 ? 0 : -99)} className="w-3 h-3 accent-red-600" />
                  <span className="text-[10px] text-gray-600">0</span>
                </label>
              </div>
              <div className="flex flex-col gap-1">
                <CopyScriptEsqueleto />
                <CopyScriptUnicoItem />
                <CopyScriptPendencias />
                <CopyScriptSoEnxoval />
              </div>
            </>
          )}
        </div>

        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
      </section>

      {/* Resumo */}
      {phaseInfo && (
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">Resumo</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{phaseInfo.totalCards}</div>
              <div className="text-xs text-gray-500">Total na {phaseName}</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{phaseInfo.toUpdate}</div>
              <div className="text-xs text-gray-500">Para atualizar</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{phaseInfo.toSkip}</div>
              <div className="text-xs text-gray-500">Ignorados</div>
            </div>
          </div>
        </section>
      )}

      {/* Progresso */}
      {results.length > 0 && (
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Progresso</h2>
            <span className="text-sm text-gray-500">
              {updated + errored}/{total}
              {updated > 0 && <span className="text-green-600 ml-2">{updated} atualizados</span>}
              {errored > 0 && <span className="text-red-600 ml-2">{errored} erro(s)</span>}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-6">
            <div className="h-3 rounded-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: errored > 0 && updated === 0 ? "#ef4444" : "#3b82f6" }} />
          </div>
          <div className="space-y-2">
            {results.map((r, idx) => (
              <div key={idx} className={`flex items-center justify-between px-4 py-3 rounded-md border ${r.action === "updated" ? "bg-green-50 border-green-200" : r.action === "error" ? "bg-red-50 border-red-200" : r.action === "processing" ? "bg-blue-50 border-blue-200" : r.action === "skipped" ? "bg-yellow-50 border-yellow-200" : "bg-gray-50 border-gray-200"}`}>
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {r.action === "updated" && "✅"}
                    {r.action === "error" && "❌"}
                    {r.action === "skipped" && "⏭️"}
                    {r.action === "processing" && <span className="inline-block animate-spin">⏳</span>}
                    {r.action === "pending" && "⏸️"}
                  </span>
                  <CopyableCode code={r.title} className="text-sm" />
                </div>
                <span className="text-xs text-gray-600 max-w-md text-right">{r.details}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Lista de cards carregados */}
      {cards.length > 0 && results.length === 0 && (
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-3">Cards na {phaseName}</h2>
          <div className="space-y-2">
            {cards.map((c) => (
              <div key={c.id} className={`px-4 py-3 rounded-md border ${c.skip ? "bg-yellow-50 border-yellow-200" : "bg-gray-50 border-gray-200"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{c.skip ? "⏭️" : "📋"}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <CopyableCode code={c.title} className="text-sm" />
                        {c.pipe1Phase && (
                          <span className="text-[10px] font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                            Pipe 1 · {c.pipe1Phase}
                          </span>
                        )}
                      </div>
                      {c.labels.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {c.labels.map((l) => (
                            <span key={l} className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded">{l}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {c.skip && c.skipReason?.includes("Weslley") && c.firstComment && !manualStatuses[c.id] && (
                      <button
                        onClick={() => openManualEditor(c.id, c.firstComment || "")}
                        disabled={manualUpdating !== null}
                        className="bg-yellow-500 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-yellow-600 disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        Editar comentário
                      </button>
                    )}
                    {manualStatuses[c.id] && (
                      <span className={`text-xs ${manualStatuses[c.id].status === "updated" ? "text-green-600" : "text-red-600"}`}>
                        {manualStatuses[c.id].message}
                      </span>
                    )}
                    <div className="text-right">
                      <div className="text-xs text-gray-500">{c.assignees.join(", ") || "Sem responsável"}</div>
                      {c.skip && <div className="text-xs text-yellow-600 mt-0.5">{c.skipReason || "Ignorado"}</div>}
                    </div>
                  </div>
                </div>

                {/* Último comentário (cards disponíveis para atualizar) */}
                {!c.skip && c.lastComment && editingManualCard !== c.id && (
                  <div className="mt-2 bg-gray-50 rounded-md p-3 border border-gray-200">
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto">{c.lastComment}</pre>
                  </div>
                )}

                {/* Editor de comentário manual */}
                {editingManualCard === c.id && (
                  <div className="mt-3 bg-yellow-50 rounded-md p-4 border border-yellow-200">
                    <p className="text-xs font-medium text-yellow-700 mb-2">Edite o comentário antes de enviar:</p>
                    <textarea
                      value={manualCommentText}
                      onChange={(e) => setManualCommentText(e.target.value)}
                      rows={15}
                      className="w-full border border-yellow-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={sendManualComment}
                        disabled={manualUpdating !== null}
                        className="bg-yellow-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-yellow-700 disabled:opacity-50 transition-colors"
                      >
                        {manualUpdating === c.id ? "Enviando..." : "Enviar comentário"}
                      </button>
                      <button
                        onClick={() => setEditingManualCard(null)}
                        className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-300 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Lista de cards Fase 4 Ativos */}
      {ativosCards.length > 0 && (
        <section className="space-y-3 mt-6">
          <h2 className="text-lg font-semibold mb-3">Fase 4 Ativos ({ativosCards.length} cards)</h2>
          {ativosCards.map((c) => {
            const cardStatus = ativosStatuses[c.id];
            const isUpdating = ativosUpdating === c.id;
            return (
              <div key={c.id} className={`bg-white rounded-lg shadow p-5 border-l-4 ${cardStatus?.status === "updated" ? "border-l-green-500" : cardStatus?.status === "error" ? "border-l-red-500" : "border-l-blue-500"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <CopyableCode code={c.title} className="text-base" />
                    <span className="text-xs text-gray-500 ml-3">Vencimento: {c.dueFormatted}</span>
                    {c.assignees.length > 0 && (
                      <span className="text-xs text-gray-400 ml-3">{c.assignees.join(", ")}</span>
                    )}
                    {c.pipe1Phase && <span className="text-xs font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded ml-2">{c.pipe1Phase}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {cardStatus?.status === "updated" && <span className="text-green-600 text-xs">{cardStatus.message}</span>}
                    {cardStatus?.status === "error" && <span className="text-red-600 text-xs">{cardStatus.message}</span>}
                    {!cardStatus && (
                      <>
                        <WithHelp help="1. Abre editor com comentário atualizado (editável antes de enviar)~2. Adiciona tag 'Imóvel Ativo'~3. Atualiza vencimento +3 dias úteis às 22:00~4. Envia o comentário editado~5. Preenche 'Adequações sinalizadas' → Imóvel ativado~6. Move o card para Fase 5~7. Preenche campos na Fase 5 baseado no comentário editado:~- Validação Enxoval: ❌ → texto do enxoval / ✔️ → ok~- Itens faltantes: ❌ → só itens sem ✅ (itens com ✅ são ignorados) / ✔️ → ok~- Manutenções pendentes: ❌ → só itens sem ✅ / ✔️ → ok">
                          <button
                            onClick={() => openAtivoEditor(c.id)}
                            disabled={ativosUpdating !== null || !c.lastComment}
                            className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                          >
                            Atualizar Ativo
                          </button>
                        </WithHelp>
                        <WithHelp help="Abre editor lateral com o último comentário do card.~Ao enviar: adiciona o texto editado como NOVO comentário no card.~NÃO altera vencimento, tags, campos nem move de fase.">
                          <button
                            onClick={() => openAtivoCommentEditor(c.id)}
                            disabled={ativosUpdating !== null || !c.lastComment}
                            className="bg-yellow-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-yellow-600 disabled:opacity-50 transition-colors whitespace-nowrap"
                          >
                            Atualizar
                          </button>
                        </WithHelp>
                      </>
                    )}
                  </div>
                </div>

                {/* Editor lateral */}
                {editingAtivo === c.id && (
                  <div className="fixed inset-0 z-50 flex">
                    <div className="w-1/2 bg-black/30" onClick={() => setEditingAtivo(null)} />
                    <div className="w-1/2 bg-white shadow-xl p-6 overflow-y-auto">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900">Editar comentário — {c.title}</h3>
                        <button onClick={() => setEditingAtivo(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
                      </div>
                      <div className="mb-3 text-xs text-gray-500">
                        Edite o comentário antes de enviar. Após enviar: preenche campos, adiciona tag, atualiza vencimento e move para Fase 5.
                      </div>
                      <textarea value={ativoCommentText} onChange={(e) => setAtivoCommentText(e.target.value)} rows={25} className="w-full border border-green-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500" />
                      <div className="flex gap-2 mt-4">
                        <WithHelp help="1. Adiciona tag 'Imóvel Ativo'~2. Atualiza vencimento +3 dias úteis às 22:00~3. Envia o comentário editado~4. Preenche 'Adequações sinalizadas' → Imóvel ativado~5. Move o card para Fase 5~6. Preenche campos na Fase 5 baseado no comentário editado:~- Validação Enxoval: ❌ → texto do enxoval / ✔️ → ok~- Itens faltantes: ❌ → só itens sem ✅ (itens com ✅ são ignorados) / ✔️ → ok~- Manutenções pendentes: ❌ → só itens sem ✅ / ✔️ → ok">
                          <button onClick={sendAtivoComment} disabled={ativosUpdating !== null} className="bg-green-600 text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                            {isUpdating ? "Enviando..." : "Enviar e mover para Fase 5"}
                          </button>
                        </WithHelp>
                        <button onClick={() => setEditingAtivo(null)} className="bg-gray-200 text-gray-700 px-6 py-2.5 rounded-md text-sm font-medium hover:bg-gray-300 transition-colors">
                          Cancelar
                        </button>
                      </div>
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                        <CopyScriptEsqueleto cardTitle={c.title} lastComment={c.lastComment} />
                        <CopyScriptUnicoItem />
                        <CopyScriptPendencias cardTitle={c.title} lastComment={c.lastComment} />
                        <CopyScriptSoEnxoval cardTitle={c.title} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Editor lateral — só atualizar comentário */}
                {editingAtivoComment === c.id && (
                  <div className="fixed inset-0 z-50 flex">
                    <div className="w-1/2 bg-black/30" onClick={() => setEditingAtivoComment(null)} />
                    <div className="w-1/2 bg-white shadow-xl p-6 overflow-y-auto">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900">Atualizar comentário — {c.title}</h3>
                        <button onClick={() => setEditingAtivoComment(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
                      </div>
                      <div className="mb-3 text-xs text-gray-500">
                        Edite o texto abaixo e envie como novo comentário no card. Não altera vencimento, tags, campos nem move de fase.
                      </div>
                      <textarea value={ativoCommentOnlyText} onChange={(e) => setAtivoCommentOnlyText(e.target.value)} rows={25} className="w-full border border-yellow-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-500" />
                      <div className="flex gap-2 mt-4">
                        <WithHelp help="Envia o comentário editado como novo comentário no card do Pipefy">
                          <button onClick={sendAtivoCommentOnly} disabled={ativosUpdating !== null} className="bg-yellow-600 text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-yellow-700 disabled:opacity-50 transition-colors">
                            {isUpdating ? "Enviando..." : "Enviar comentário"}
                          </button>
                        </WithHelp>
                        <button onClick={() => setEditingAtivoComment(null)} className="bg-gray-200 text-gray-700 px-6 py-2.5 rounded-md text-sm font-medium hover:bg-gray-300 transition-colors">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {c.labels.length > 0 && (
                  <div className="flex gap-1 mb-3">
                    {c.labels.map((l) => (
                      <span key={l} className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded">{l}</span>
                    ))}
                  </div>
                )}
                {c.lastComment && editingAtivo !== c.id ? (
                  <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-gray-700">{c.lastCommentAuthor}</span>
                      <span className="text-[10px] text-gray-400">{formatAtivosCommentDate(c.lastCommentDate)}</span>
                    </div>
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">{c.lastComment}</pre>
                  </div>
                ) : !c.lastComment ? (
                  <p className="text-xs text-gray-400">Sem comentários</p>
                ) : null}
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}

// =====================
// TAB: FASE 5 (cards individuais com comentário)
// =====================

interface Phase5Card {
  id: string;
  title: string;
  due_date: string | null;
  dueFormatted: string;
  assignees: string[];
  labels: string[];
  lastComment: string;
  lastCommentAuthor: string;
  lastCommentDate: string;
  hasRecord: boolean;
  recordId: string;
  owner?: { nome: string; telefone: string; email: string };
}

function Phase5EditButton({ cardId, cardTitle, lastComment }: { cardId: string; cardTitle: string; lastComment: string }) {
  const [showEditor, setShowEditor] = useState(false);
  const [editText, setEditText] = useState(lastComment);
  const lastCommentRef = useRef(lastComment);
  if (lastComment !== lastCommentRef.current) {
    lastCommentRef.current = lastComment;
    setEditText(lastComment);
  }
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showFinalizar, setShowFinalizar] = useState(false);
  const [amenitesChecked, setAmenitesChecked] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const handleUpdateComment = async () => {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/finalizar-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, action: "update_comment", commentText: editText }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ success: true, message: "Comentário atualizado" });
        setShowEditor(false);
      } else {
        setResult({ success: false, message: data.error || "Erro" });
      }
    } catch {
      setResult({ success: false, message: "Erro de conexão" });
    } finally {
      setSending(false);
    }
  };

  const handleFinalizar = async () => {
    if (!confirm(`Finalizar o card ${cardTitle}? Isso irá preencher todos os campos e mover para Concluídos.`)) return;
    setFinalizing(true);
    setResult(null);
    try {
      const res = await fetch("/api/finalizar-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, action: "finalizar", amenitesOption: amenitesChecked ? "Verificado + avisado anúncios" : "Nenhum dos itens foi comprado" }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ success: true, message: data.details });
      } else {
        setResult({ success: false, message: data.error || "Erro" });
      }
    } catch {
      setResult({ success: false, message: "Erro de conexão" });
    } finally {
      setFinalizing(false);
      setShowFinalizar(false);
    }
  };

  return (
    <>
      <WithHelp help="Abre painel de finalização com todas as etapas">
        <button onClick={() => { setShowFinalizar(!showFinalizar); setShowEditor(false); }} className="bg-green-600 text-white px-5 py-1.5 rounded text-xs font-medium hover:bg-green-700 transition-colors whitespace-nowrap">
          Finalizar
        </button>
      </WithHelp>
      <WithHelp help="Abre editor lateral com o último comentário do card">
        <button onClick={() => { setShowEditor(!showEditor); setShowFinalizar(false); }} className="bg-yellow-500 text-white px-5 py-1.5 rounded text-xs font-medium hover:bg-yellow-600 transition-colors whitespace-nowrap">
          Atualizar
        </button>
      </WithHelp>
      <label className="flex items-center justify-center gap-1 cursor-pointer" title="Verificado + avisado anúncios">
        <input type="checkbox" checked={amenitesChecked} onChange={(e) => setAmenitesChecked(e.target.checked)} className="w-3 h-3 accent-green-600" />
        <span className="text-[10px] text-gray-500">Amenites</span>
      </label>

      {result && (
        <div className={`mt-2 p-2 rounded text-xs ${result.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {result.message}
        </div>
      )}

      {showEditor && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-1/2 bg-black/30" onClick={() => setShowEditor(false)} />
          <div className="w-1/2 bg-white shadow-xl p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Editar comentário — {cardTitle}</h3>
              <button onClick={() => setShowEditor(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={25} className="w-full border border-yellow-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-500" />
            <div className="flex gap-2 mt-4">
              <WithHelp help="Envia o comentário editado como novo comentário no card do Pipefy">
                <button onClick={handleUpdateComment} disabled={sending} className="bg-yellow-600 text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-yellow-700 disabled:opacity-50 transition-colors">
                  {sending ? "Enviando..." : "Enviar comentário"}
                </button>
              </WithHelp>
              <WithHelp help="Fecha o editor sem enviar o comentário">
                <button onClick={() => setShowEditor(false)} className="bg-gray-200 text-gray-700 px-6 py-2.5 rounded-md text-sm font-medium hover:bg-gray-300 transition-colors">
                  Cancelar
                </button>
              </WithHelp>
            </div>
          </div>
        </div>
      )}

      {showFinalizar && (
        <div className="mt-3 bg-green-50 rounded-md p-4 border border-green-200 w-full">
          <p className="text-xs font-medium text-green-700 mb-3">Finalizar card — todas as ações abaixo serão executadas:</p>
          <ul className="text-xs text-green-800 space-y-1 mb-3">
            <li>1. Validação Enxoval (baseado no comentário)</li>
            <li>2. Itens faltantes → ok</li>
            <li>3. Manutenções pendentes → ok</li>
            <li>4. Adequações sinalizadas → Todas finalizadas</li>
            <li>5. Marca do enxoval (Matinali se COMPRADO PP CSO)</li>
            <li>6. Gerar registro de enxoval (se não existir)</li>
            <li>7. Solicitar atualização vistoria</li>
            <li>8. Subir vistoria SAPRON</li>
            <li>9. Enviar vistoria proprietário</li>
            <li>10. Verificar amenites (selecione abaixo)</li>
            <li>11. Aviso despesa → Fluxo aberto</li>
            <li>12. Mover para Concluídos</li>
          </ul>
          <p className="text-xs text-green-700 mb-3">Amenites: <strong>{amenitesChecked ? "Verificado + avisado anúncios" : "Nenhum dos itens foi comprado"}</strong></p>
          <div className="flex gap-2">
            <WithHelp help="Executa todas as etapas:~1. Validação Enxoval~2. Itens faltantes → ok~3. Manutenções pendentes → ok~4. Adequações → Todas finalizadas~5. Marca do enxoval~6. Gerar registro de enxoval~7. Solicitar atualização vistoria~8. Subir vistoria SAPRON~9. Enviar vistoria proprietário~10. Verificar amenites~11. Aviso despesa → Fluxo aberto~12. Remove tags (Itens/Manutenções grandes e pequenas)~13. Atualiza vencimento para próximo dia útil às 22:00~14. Move para Concluídos~15. Envia aviso de lançamento de despesa no Slack (busca franquia no Pipe 1 fases 1-10, data de hoje). Se não encontrar o código nas fases 1-10, o aviso não é enviado">
              <button onClick={handleFinalizar} disabled={finalizing} className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                {finalizing ? "Finalizando..." : "Confirmar Finalização"}
              </button>
            </WithHelp>
            <WithHelp help="Fecha o painel de finalização sem executar nenhuma ação">
              <button onClick={() => setShowFinalizar(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-300 transition-colors">
                Cancelar
              </button>
            </WithHelp>
          </div>
        </div>
      )}
    </>
  );
}

function CopyFinalizarSults() {
  const [copied, setCopied] = useState(false);
  const text = `Olá Ana,


Todas as pendências desta unidade foram finalizadas.


Com isso, finalizamos a implantação deste imóvel!


Muito obrigado por toda colaboração e boas reservas!`;

  return (
    <WithHelp help="Copia texto de finalização para enviar no Sults">
      <button
        onClick={() => {
          navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        }}
        className={`px-6 py-3 rounded-md font-medium transition-colors ${copied ? "bg-green-600 text-white" : "bg-purple-500 text-white hover:bg-purple-600"}`}
      >
        {copied ? "Copiado!" : "Finalizar Sults"}
      </button>
    </WithHelp>
  );
}

function OwnerField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span
      className="text-[10px] text-gray-500 cursor-pointer hover:text-gray-700 transition-colors"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title="Clique para copiar"
    >
      <span className="text-gray-400">{label}:</span> <span className="font-medium text-gray-600">{value}</span>
      {copied && <span className="text-green-600 ml-1">copiado!</span>}
    </span>
  );
}

function TabPhase5() {
  const [cards, setCards] = useState<Phase5Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatingCard, setUpdatingCard] = useState<string | null>(null);
  const [cardStatuses, setCardStatuses] = useState<Record<string, { status: "updated" | "error"; message: string }>>({});
  const [searchCode, setSearchCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [extraDays, setExtraDays] = useState(0);

  const searchCard = async () => {
    if (!searchCode.trim()) return;
    setSearching(true);
    setError("");
    setCardStatuses({});
    try {
      const res = await fetch(`/api/update-cards-phase5?search=${encodeURIComponent(searchCode.trim())}`);
      const data = await res.json();
      if (data.success) {
        setCards(data.cards);
      } else {
        setError(data.error || "Erro ao pesquisar");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setSearching(false);
    }
  };

  const loadCards = async () => {
    setLoading(true);
    setError("");
    setCardStatuses({});
    try {
      const res = await fetch("/api/update-cards-phase5");
      const data = await res.json();
      if (data.success) {
        setCards(data.cards);
      } else {
        setError(data.error || "Erro ao carregar cards");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  const updateSingleCard = async (cardId: string) => {
    setUpdatingCard(cardId);
    try {
      const res = await fetch("/api/update-cards-phase5", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, extraDays }),
      });
      const data = await res.json();
      if (data.success && data.action === "updated") {
        setCardStatuses((prev) => ({ ...prev, [cardId]: { status: "updated", message: data.details } }));
      } else {
        setCardStatuses((prev) => ({ ...prev, [cardId]: { status: "error", message: data.error || data.details || "Erro" } }));
      }
    } catch {
      setCardStatuses((prev) => ({ ...prev, [cardId]: { status: "error", message: "Erro de conexão" } }));
    } finally {
      setUpdatingCard(null);
    }
  };

  const formatCommentDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm} ${hh}:${min}`;
  };

  return (
    <>
      <FormAtualizarAnuncio />

      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">Fase 5 — Imóvel Ativo</h2>
        <p className="text-sm text-gray-500 mb-4">
          Lista todos os cards da Fase 5 com o último comentário. Clique no botão para atualizar individualmente: vencimento +3 dias úteis às 22:00 e comentário com nova data.
        </p>

        <div className="flex gap-2 items-center mb-3">
          <input
            type="text"
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && searchCard()}
            placeholder="Pesquisar card..."
            className="border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
          />
          <WithHelp help="Pesquisa um card específico pelo código na Fase 5, independente do vencimento. Mostra com todas as opções (+3 dias, Atualizar, Finalizar)">
            <button
              onClick={searchCard}
              disabled={searching || !searchCode.trim()}
              className="bg-blue-500 text-white px-4 py-2.5 rounded-md text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {searching ? "Buscando..." : "Pesquisar"}
            </button>
          </WithHelp>
        </div>

        <div className="flex gap-3">
          <WithHelp help="Busca todos os cards da Fase 5 com último comentário e informações de registro">
            <button
              onClick={loadCards}
              disabled={loading}
              className="bg-gray-600 text-white px-6 py-3 rounded-md font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Carregando..." : `Carregar Cards${cards.length > 0 ? ` (${cards.length})` : ""}`}
            </button>
          </WithHelp>
          <CopyFupButton days={3} template="fase5" extraDays={extraDays} />
          <CopyFinalizarSults />
          <div className="flex flex-col gap-0.5 bg-gray-100 rounded-md px-2 py-1">
            {[1, 2, 3].map((d) => (
              <label key={d} className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={extraDays === d} onChange={() => setExtraDays(extraDays === d ? 0 : d)} className="w-3 h-3 accent-blue-600" />
                <span className="text-[10px] text-gray-600">+{d}</span>
              </label>
            ))}
          </div>
        </div>
        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
      </section>

      {cards.length > 0 && (
        <section className="space-y-3">
          {cards.map((c) => {
            const cardStatus = cardStatuses[c.id];
            const isUpdating = updatingCard === c.id;
            return (
              <div key={c.id} className={`bg-white rounded-lg shadow p-5 border-l-4 ${cardStatus?.status === "updated" ? "border-l-green-500" : cardStatus?.status === "error" ? "border-l-red-500" : "border-l-blue-500"}`}>
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div>
                      <CopyableCode code={c.title} className="text-base" />
                      <span className="text-xs text-gray-500 ml-3">Vencimento: {c.dueFormatted}</span>
                    </div>
                    <div className="mt-0.5">
                      {c.assignees.length > 0 && (
                        <span className="text-xs text-gray-400">{c.assignees.join(", ")}</span>
                      )}
                      {c.hasRecord ? (
                        <span className="text-xs text-green-600 ml-2">Registro #{c.recordId}</span>
                      ) : (
                        <span className="text-xs text-red-500 ml-2">Sem registro</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="grid grid-cols-2 gap-1">
                      <WithHelp help="1. Atualiza vencimento +3 dias úteis às 22:00~2. Busca o último comentário do card~3. Substitui a data do FUP~4. Adiciona o comentário atualizado">
                        <button onClick={() => updateSingleCard(c.id)} disabled={isUpdating || updatingCard !== null} className="bg-blue-600 text-white px-5 py-1.5 rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap">
                          {isUpdating ? "..." : "+3 dias"}
                        </button>
                      </WithHelp>
                      <Phase5EditButton cardId={c.id} cardTitle={c.title} lastComment={c.lastComment} />
                    </div>
                    <CopyCobrancaButtons cardTitle={c.title} lastComment={c.lastComment} />
                  </div>
                </div>
                {cardStatus && (
                  <div className={`relative mt-2 p-3 rounded-md text-xs ${cardStatus.status === "updated" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    <button onClick={() => setCardStatuses((prev) => { const n = { ...prev }; delete n[c.id]; return n; })} className="absolute top-1 right-2 text-gray-400 hover:text-gray-600 text-base leading-none">&times;</button>
                    <span className="pr-4 block">{cardStatus.message}</span>
                  </div>
                )}

                {/* Proprietário */}
                {c.owner && (c.owner.nome || c.owner.telefone || c.owner.email) && (
                  <div className="flex gap-4 mt-2 mb-1">
                    {c.owner.nome && <OwnerField label="Proprietário" value={c.owner.nome} />}
                    {c.owner.telefone && <OwnerField label="Telefone" value={c.owner.telefone} />}
                    {c.owner.email && <OwnerField label="E-mail" value={c.owner.email} />}
                  </div>
                )}

                {/* Labels */}
                {c.labels.length > 0 && (
                  <div className="flex gap-1 mb-3">
                    {c.labels.map((l) => (
                      <span key={l} className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded">{l}</span>
                    ))}
                  </div>
                )}

                {/* Último comentário */}
                {c.lastComment ? (
                  <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-gray-700">{c.lastCommentAuthor}</span>
                      <span className="text-[10px] text-gray-400">{formatCommentDate(c.lastCommentDate)}</span>
                    </div>
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">{c.lastComment}</pre>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Sem comentários</p>
                )}
              </div>
            );
          })}
        </section>
      )}

    </>
  );
}

// =====================
// COMPONENTE: Lançamento de Despesa no Slack
// =====================

function SlackDespesa() {
  const [code, setCode] = useState("");
  const [franquia, setFranquia] = useState("");
  const [data, setData] = useState("");
  const [loadingFranquia, setLoadingFranquia] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Buscar franquia ao digitar código
  useEffect(() => {
    if (code.trim().length >= 3) {
      const timer = setTimeout(async () => {
        setLoadingFranquia(true);
        try {
          const res = await fetch(`/api/get-franqueado?code=${encodeURIComponent(code.trim())}`);
          const d = await res.json();
          if (d.franqueado) setFranquia(d.franqueado);
        } catch { /* silencioso */ }
        finally { setLoadingFranquia(false); }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [code]);

  const handleEnviar = async () => {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/slack-despesa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: code.trim(), franquia, data }),
      });
      const d = await res.json();
      if (d.success) {
        setResult({ success: true, message: d.message });
        setCode("");
        setFranquia("");
        setData("");
      } else {
        setResult({ success: false, message: d.error || "Erro" });
      }
    } catch {
      setResult({ success: false, message: "Erro de conexão" });
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="bg-white rounded-lg shadow p-6 mt-6">
      <h3 className="text-lg font-semibold mb-1">Aviso de Lançamento de Despesa</h3>
      <p className="text-xs text-gray-500 mb-4">Envia mensagem no canal #despesas-implantação do Slack.</p>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Código do imóvel</label>
          <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ex: AGU0000" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Franquia {loadingFranquia && "(buscando...)"}</label>
          <input type="text" value={franquia} onChange={(e) => setFranquia(e.target.value)} placeholder="Preenchido automaticamente" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Data lançamento</label>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <WithHelp help="Envia mensagem de aviso de lançamento de despesa no canal #despesas-implantação do Slack">
          <button onClick={handleEnviar} disabled={sending || !code.trim() || !franquia || !data} className="bg-green-600 text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
            {sending ? "Enviando..." : "Enviar no Slack"}
          </button>
        </WithHelp>
        {result && <span className={`text-xs ${result.success ? "text-green-600" : "text-red-600"}`}>{result.message}</span>}
      </div>
    </section>
  );
}

// =====================
// TAB: REVISÃO (Complexa + Revisão de Pendências)
// =====================

interface RevisaoCard {
  id: string;
  title: string;
  type: "complexa" | "revisao" | "none";
  due_date: string | null;
  dueFormatted: string;
  assignees: string[];
  labels: string[];
  labelIds: string[];
  lastComment: string;
  lastCommentAuthor: string;
  lastCommentDate: string;
}

function getDefaultRevisaoComment(fupDate: string): string {
  return `🟡 Imóvel em ativação

🚨 Aguardando ativação do imóvel

⏭️ Fup: ${fupDate}

...................................................................................................

❌ ENXOVAL

✔️ ITENS MÍNIMOS

✔️ MANUTENÇÃO

✔️ INTERNET

✔️PIN`;
}

function TabRevisao() {
  const [cards, setCards] = useState<RevisaoCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatingCard, setUpdatingCard] = useState<string | null>(null);
  const [cardStatuses, setCardStatuses] = useState<Record<string, { status: "updated" | "error"; message: string }>>({});
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editingComplexaComment, setEditingComplexaComment] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [complexaCommentText, setComplexaCommentText] = useState("");
  const [cardOptions, setCardOptions] = useState<Record<string, { complexa: boolean; itens: boolean; manut: boolean; pin: boolean }>>({});
  const [summary, setSummary] = useState<{ complexaCount: number; revisaoCount: number } | null>(null);
  const [searchCode, setSearchCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [extraDays, setExtraDays] = useState(0);
  const [editingOnlyComment, setEditingOnlyComment] = useState<string | null>(null);
  const [onlyCommentText, setOnlyCommentText] = useState("");

  const getCardOpts = (id: string) => cardOptions[id] || { complexa: false, itens: false, manut: false, pin: false };
  const setCardOpt = (id: string, key: "complexa" | "itens" | "manut" | "pin", val: boolean) => {
    setCardOptions((prev) => ({ ...prev, [id]: { ...getCardOpts(id), [key]: val } }));
  };

  const applyCardData = (data: any) => {
    const filtered = data.cards.filter((c: RevisaoCard) => c.type !== "none");
    setCards(filtered);
    setSummary({ complexaCount: data.complexaCount, revisaoCount: data.revisaoCount });
    const opts: Record<string, { complexa: boolean; itens: boolean; manut: boolean; pin: boolean }> = {};
    for (const c of filtered) {
      opts[c.id] = {
        complexa: (c.labelIds || []).includes("314328534"),
        itens: (c.labelIds || []).includes("310938809"),
        manut: (c.labelIds || []).includes("310938821"),
        pin: (c.labelIds || []).includes("312148103"),
      };
    }
    setCardOptions(opts);
  };

  const searchCard = async () => {
    if (!searchCode.trim()) return;
    setSearching(true);
    setError("");
    setCardStatuses({});
    setEditingComment(null);
    try {
      const res = await fetch(`/api/update-cards-revisao?search=${encodeURIComponent(searchCode.trim())}`);
      const data = await res.json();
      if (data.success) {
        applyCardData(data);
      } else {
        setError(data.error || "Erro ao pesquisar");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setSearching(false);
    }
  };

  const loadCards = async () => {
    setLoading(true);
    setError("");
    setCardStatuses({});
    setEditingComment(null);
    try {
      const res = await fetch("/api/update-cards-revisao");
      const data = await res.json();
      if (data.success) {
        applyCardData(data);
      } else {
        setError(data.error || "Erro ao carregar");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  const updateComplexa = async (cardId: string) => {
    setUpdatingCard(cardId);
    try {
      const res = await fetch("/api/update-cards-revisao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, type: "complexa", extraDays }),
      });
      const data = await res.json();
      if (data.success) {
        setCardStatuses((prev) => ({ ...prev, [cardId]: { status: "updated", message: data.details } }));
      } else {
        setCardStatuses((prev) => ({ ...prev, [cardId]: { status: "error", message: data.error || "Erro" } }));
      }
    } catch {
      setCardStatuses((prev) => ({ ...prev, [cardId]: { status: "error", message: "Erro de conexão" } }));
    } finally {
      setUpdatingCard(null);
    }
  };

  const sendComplexaComment = async () => {
    if (!editingComplexaComment) return;
    const cardId = editingComplexaComment;
    const opts = getCardOpts(cardId);
    setUpdatingCard(cardId);
    try {
      const res = await fetch("/api/update-cards-revisao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId,
          type: "complexa_update",
          customComment: complexaCommentText,
          isComplexa: opts.complexa,
          addItensPequenos: opts.itens,
          addManutencoesPequenas: opts.manut,
          addPin: opts.pin,
          extraDays,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCardStatuses((prev) => ({ ...prev, [cardId]: { status: "updated", message: data.details } }));
      } else {
        setCardStatuses((prev) => ({ ...prev, [cardId]: { status: "error", message: data.error || "Erro" } }));
      }
    } catch {
      setCardStatuses((prev) => ({ ...prev, [cardId]: { status: "error", message: "Erro de conexão" } }));
    } finally {
      setUpdatingCard(null);
      setEditingComplexaComment(null);
    }
  };

  const openRevisaoEditor = (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    const opts = getCardOpts(cardId);
    const days = (opts.complexa ? 1 : 2) + extraDays;
    const now = new Date();
    let added = 0;
    const next = new Date(now);
    while (added < days) {
      next.setDate(next.getDate() + 1);
      if (next.getDay() !== 0 && next.getDay() !== 6) added++;
    }
    const dd = String(next.getDate()).padStart(2, "0");
    const mm = String(next.getMonth() + 1).padStart(2, "0");
    const fupDate = `${dd}/${mm}`;

    const base = card?.lastComment || "";
    const updated = base.includes("⏭️")
      ? base.replace(/⏭️\s*Fup:\s*\d{2}\/\d{2}/, `⏭️ Fup: ${fupDate}`)
      : base;

    setEditingComment(cardId);
    setCommentText(updated);
  };

  const sendRevisaoComment = async () => {
    if (!editingComment || !commentText.trim()) return;
    setUpdatingCard(editingComment);
    try {
      const res = await fetch("/api/update-cards-revisao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: editingComment, type: "revisao", customComment: commentText, isComplexa: getCardOpts(editingComment).complexa, addItensPequenos: getCardOpts(editingComment).itens, addManutencoesPequenas: getCardOpts(editingComment).manut, addPin: getCardOpts(editingComment).pin, extraDays }),
      });
      const data = await res.json();
      if (data.success) {
        setCardStatuses((prev) => ({ ...prev, [editingComment!]: { status: "updated", message: data.details } }));
      } else {
        setCardStatuses((prev) => ({ ...prev, [editingComment!]: { status: "error", message: data.error || "Erro" } }));
      }
    } catch {
      setCardStatuses((prev) => ({ ...prev, [editingComment!]: { status: "error", message: "Erro de conexão" } }));
    } finally {
      setUpdatingCard(null);
      setEditingComment(null);
    }
  };

  const openOnlyCommentEditor = (cardId: string) => {
    const opts = getCardOpts(cardId);
    const days = (opts.complexa ? 1 : 2) + extraDays;
    const now = new Date();
    let added = 0;
    const next = new Date(now);
    while (added < days) {
      next.setDate(next.getDate() + 1);
      if (next.getDay() !== 0 && next.getDay() !== 6) added++;
    }
    const dd = String(next.getDate()).padStart(2, "0");
    const mm = String(next.getMonth() + 1).padStart(2, "0");
    const fupDate = `${dd}/${mm}`;

    setEditingOnlyComment(cardId);
    setOnlyCommentText(getDefaultRevisaoComment(fupDate));
  };

  const sendOnlyComment = async () => {
    if (!editingOnlyComment || !onlyCommentText.trim()) return;
    const cardId = editingOnlyComment;
    setUpdatingCard(cardId);
    try {
      const res = await fetch("/api/update-cards-revisao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, type: "revisao_update_comment", customComment: onlyCommentText }),
      });
      const data = await res.json();
      if (data.success) {
        setCardStatuses((prev) => ({ ...prev, [cardId]: { status: "updated", message: "Comentário atualizado" } }));
      } else {
        setCardStatuses((prev) => ({ ...prev, [cardId]: { status: "error", message: data.error || "Erro" } }));
      }
    } catch {
      setCardStatuses((prev) => ({ ...prev, [cardId]: { status: "error", message: "Erro de conexão" } }));
    } finally {
      setUpdatingCard(null);
      setEditingOnlyComment(null);
    }
  };

  const formatCommentDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const complexaCards = cards.filter((c) => c.type === "complexa");
  const revisaoCards = cards.filter((c) => c.type === "revisao");

  return (
    <>
      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">Revisão — Fase 3</h2>
        <p className="text-sm text-gray-500 mb-4">
          Cards com tag &quot;Adequação Complexa&quot; e cards com tag &quot;Revisão de Pendências Finalizada&quot; (sem complexa).
        </p>

        <div className="flex gap-2 items-center mb-3">
          <input
            type="text"
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && searchCard()}
            placeholder="Pesquisar card..."
            className="border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
          />
          <WithHelp help="Pesquisa um card específico pelo código na Fase 3, independente do vencimento. Mostra com as mesmas opções (checkboxes, editor)">
            <button
              onClick={searchCard}
              disabled={searching || !searchCode.trim()}
              className="bg-blue-500 text-white px-4 py-2.5 rounded-md text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {searching ? "Buscando..." : "Pesquisar"}
            </button>
          </WithHelp>
        </div>

        <div className="flex gap-3 items-center">
          <WithHelp help="Busca cards da Fase 3 com vencimento para hoje que possuem tag Adequação Complexa ou Revisão Finalizada">
            <button onClick={loadCards} disabled={loading} className="bg-gray-600 text-white px-6 py-3 rounded-md font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors">
              {loading ? "Carregando..." : "Carregar Cards"}
            </button>
          </WithHelp>
          <div className="flex flex-col gap-0.5 bg-gray-100 rounded-md px-2 py-1">
            {[1, 2, 3].map((d) => (
              <label key={d} className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={extraDays === d} onChange={() => setExtraDays(extraDays === d ? 0 : d)} className="w-3 h-3 accent-blue-600" />
                <span className="text-[10px] text-gray-600">+{d}</span>
              </label>
            ))}
          </div>
        </div>
        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
      </section>

      {summary && (
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{summary.complexaCount}</div>
              <div className="text-xs text-gray-500">Adequação Complexa</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{summary.revisaoCount}</div>
              <div className="text-xs text-gray-500">Revisão Finalizada</div>
            </div>
          </div>
        </section>
      )}

      {/* COMPLEXA */}
      {complexaCards.length > 0 && (
        <section className="mb-8">
          <h3 className="text-lg font-bold text-orange-700 mb-3 px-1">COMPLEXA</h3>
          <div className="space-y-3">
            {complexaCards.map((c) => {
              const cardStatus = cardStatuses[c.id];
              const isUpdating = updatingCard === c.id;
              return (
                <div key={c.id} className={`bg-white rounded-lg shadow p-5 border-l-4 ${cardStatus?.status === "updated" ? "border-l-green-500" : cardStatus?.status === "error" ? "border-l-red-500" : "border-l-orange-500"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CopyableCode code={c.title} className="text-base" />
                      <span className="text-xs text-gray-500">Vencimento: {c.dueFormatted}</span>
                      {c.labels.map((l) => (
                        <span key={l} className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded">{l}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      {cardStatus && <span className={`text-xs ${cardStatus.status === "updated" ? "text-green-600" : "text-red-600"}`}>{cardStatus.message}</span>}
                      <WithHelp help="Atualiza apenas vencimento e comentário (não usa os checkboxes):~1. Atualiza vencimento +1 dia útil às 22:00~2. Busca o último comentário do card~3. Substitui a data do FUP pela nova data~4. Adiciona o comentário atualizado no card~Obs: não altera tags nem muda de fase">
                        <button onClick={() => updateComplexa(c.id)} disabled={isUpdating || updatingCard !== null} className="bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors whitespace-nowrap">
                          {isUpdating && editingComplexaComment !== c.id ? "Atualizando..." : "+1 dia"}
                        </button>
                      </WithHelp>
                      {!cardStatus && (
                        <>
                          <WithHelp help="Abre editor lateral com o último comentário e FUP recalculado:~Se 'Complexa' marcado → FUP +1 dia útil~Se 'Complexa' desmarcado → FUP +2 dias úteis~Edite o texto antes de enviar.|Ao enviar com 'Complexa' marcado:~Vencimento +1 dia, mantém tag Complexa, adiciona/remove tags Itens e Manut conforme checkboxes, mantém na Fase 3|Ao enviar com 'Complexa' desmarcado:~Vencimento +2 dias, remove tag Complexa, adiciona/remove tags conforme checkboxes, campos obrigatórios, move para Fase 4, envia DM para Bruno no Slack: 'CÓDIGO - Liberado ✅'">
                            <button onClick={() => {
                              if (editingComplexaComment === c.id) {
                                setEditingComplexaComment(null);
                              } else {
                                const opts = getCardOpts(c.id);
                                const days = (opts.complexa ? 1 : 2) + extraDays;
                                const now = new Date();
                                let added = 0;
                                const next = new Date(now);
                                while (added < days) {
                                  next.setDate(next.getDate() + 1);
                                  if (next.getDay() !== 0 && next.getDay() !== 6) added++;
                                }
                                const dd = String(next.getDate()).padStart(2, "0");
                                const mm = String(next.getMonth() + 1).padStart(2, "0");
                                const fupDate = `${dd}/${mm}`;
                                const updatedComment = (c.lastComment || "").replace(/⏭️\s*Fup:\s*\d{2}\/\d{2}/, `⏭️ Fup: ${fupDate}`);
                                setEditingComplexaComment(c.id);
                                setComplexaCommentText(updatedComment);
                              }
                            }} className="bg-yellow-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-yellow-600 transition-colors whitespace-nowrap">
                              Atualizar Comentário
                            </button>
                          </WithHelp>
                          <div className="flex flex-col gap-0.5">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="checkbox" checked={getCardOpts(c.id).complexa} onChange={(e) => setCardOpt(c.id, "complexa", e.target.checked)} className="w-3 h-3 accent-orange-600" />
                              <span className="text-[10px] text-gray-500">Complexa</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="checkbox" checked={getCardOpts(c.id).itens} onChange={(e) => setCardOpt(c.id, "itens", e.target.checked)} className="w-3 h-3 accent-blue-600" />
                              <span className="text-[10px] text-gray-500">Itens peq.</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="checkbox" checked={getCardOpts(c.id).manut} onChange={(e) => setCardOpt(c.id, "manut", e.target.checked)} className="w-3 h-3 accent-blue-600" />
                              <span className="text-[10px] text-gray-500">Manut. peq.</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="checkbox" checked={getCardOpts(c.id).pin} onChange={(e) => setCardOpt(c.id, "pin", e.target.checked)} className="w-3 h-3 accent-red-600" />
                              <span className="text-[10px] text-gray-500">PIN</span>
                            </label>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Editor de comentário complexa */}
                  {editingComplexaComment === c.id && (
                    <div className="fixed inset-0 z-50 flex">
                      <div className="w-1/2 bg-black/30" onClick={() => setEditingComplexaComment(null)} />
                      <div className="w-1/2 bg-white shadow-xl p-6 overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-gray-900">Editar comentário — {c.title}</h3>
                          <button onClick={() => setEditingComplexaComment(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
                        </div>
                        <div className="mb-3 text-xs text-gray-500">
                          {getCardOpts(c.id).complexa ? "Complexa marcado → +1 dia, mantém na fase" : "Complexa desmarcado → +2 dias, move para Fase 4"}
                        </div>
                        <textarea value={complexaCommentText} onChange={(e) => setComplexaCommentText(e.target.value)} rows={25} className="w-full border border-yellow-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-500" />
                        <div className="flex gap-2 mt-4">
                          <WithHelp help="Se 'Complexa' marcado:~1. Vencimento +1 dia útil às 22:00~2. Mantém tag Adequação Complexa~3. Se 'Itens peq.' marcado → adiciona tag / se desmarcado → remove tag~4. Se 'Manut. peq.' marcado → adiciona tag / se desmarcado → remove tag~5. Mantém o card na Fase 3~6. Envia o comentário editado|Se 'Complexa' desmarcado:~1. Vencimento +2 dias úteis às 22:00~2. Remove a tag Adequação Complexa~3. Se 'Itens peq.' marcado → adiciona tag / se desmarcado → remove tag~4. Se 'Manut. peq.' marcado → adiciona tag / se desmarcado → remove tag~5. Preenche campos obrigatórios (mensagem enviada + revisão realizada)~6. Move o card para a Fase 4~7. Envia o comentário editado~8. Envia DM no Slack para Bruno: 'CÓDIGO - Liberado ✅'">
                            <button onClick={sendComplexaComment} disabled={updatingCard !== null} className="bg-yellow-600 text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-yellow-700 disabled:opacity-50 transition-colors">
                              {isUpdating ? "Enviando..." : "Enviar comentário"}
                            </button>
                          </WithHelp>
                          <WithHelp help="Fecha o editor sem enviar alterações">
                            <button onClick={() => setEditingComplexaComment(null)} className="bg-gray-200 text-gray-700 px-6 py-2.5 rounded-md text-sm font-medium hover:bg-gray-300 transition-colors">
                              Cancelar
                            </button>
                          </WithHelp>
                        </div>
                      </div>
                    </div>
                  )}

                  {c.lastComment && editingComplexaComment !== c.id && (
                    <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-gray-700">{c.lastCommentAuthor}</span>
                        <span className="text-[10px] text-gray-400">{formatCommentDate(c.lastCommentDate)}</span>
                      </div>
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">{c.lastComment}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* REVISÃO DE PENDÊNCIAS FINALIZADA */}
      {revisaoCards.length > 0 && (
        <section className="mb-8">
          <h3 className="text-lg font-bold text-purple-700 mb-3 px-1">REVISÃO DE PENDÊNCIAS FINALIZADA</h3>
          <div className="space-y-3">
            {revisaoCards.map((c) => {
              const cardStatus = cardStatuses[c.id];
              const isUpdating = updatingCard === c.id;
              const isEditing = editingComment === c.id;
              return (
                <div key={c.id} className={`bg-white rounded-lg shadow p-5 border-l-4 ${cardStatus?.status === "updated" ? "border-l-green-500" : cardStatus?.status === "error" ? "border-l-red-500" : "border-l-purple-500"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CopyableCode code={c.title} className="text-base" />
                      <span className="text-xs text-gray-500">Vencimento: {c.dueFormatted}</span>
                      {c.labels.map((l) => (
                        <span key={l} className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded">{l}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      {cardStatus && <span className={`text-xs ${cardStatus.status === "updated" ? "text-green-600" : "text-red-600"}`}>{cardStatus.message}</span>}
                      {!isEditing && !cardStatus && (
                        <>
                          <WithHelp help="Abre editor lateral com o template padrão (Imóvel em ativação) e FUP calculado.~Ao enviar: adiciona o texto editado como NOVO comentário no card.~NÃO altera vencimento, responsável, tags, campos nem move de fase.">
                            <button onClick={() => openOnlyCommentEditor(c.id)} disabled={updatingCard !== null} className="bg-yellow-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-yellow-600 disabled:opacity-50 transition-colors whitespace-nowrap">
                              Atualizar comentário
                            </button>
                          </WithHelp>
                          <WithHelp help="Abre editor com comentário padrão e FUP calculado:~Se 'Complexa' marcado → FUP +1 dia útil~Se 'Complexa' desmarcado → FUP +2 dias úteis~Edite o texto antes de enviar.|Ao enviar com 'Complexa' marcado:~Muda responsável para Weslley, vencimento +1 dia, adiciona tag Complexa, adiciona tags Itens/Manut se marcados, mantém na Fase 3|Ao enviar com 'Complexa' desmarcado:~Muda responsável para Weslley, vencimento +2 dias, adiciona tags Itens/Manut se marcados, preenche campos obrigatórios, move para Fase 4">
                            <button onClick={() => openRevisaoEditor(c.id)} disabled={updatingCard !== null} className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors whitespace-nowrap">
                              Fase 4/Complexa
                            </button>
                          </WithHelp>
                          <div className="flex flex-col gap-0.5">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="checkbox" checked={getCardOpts(c.id).complexa} onChange={(e) => setCardOpt(c.id, "complexa", e.target.checked)} className="w-3 h-3 accent-orange-600" />
                              <span className="text-[10px] text-gray-500">Complexa</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="checkbox" checked={getCardOpts(c.id).itens} onChange={(e) => setCardOpt(c.id, "itens", e.target.checked)} className="w-3 h-3 accent-blue-600" />
                              <span className="text-[10px] text-gray-500">Itens peq.</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="checkbox" checked={getCardOpts(c.id).manut} onChange={(e) => setCardOpt(c.id, "manut", e.target.checked)} className="w-3 h-3 accent-blue-600" />
                              <span className="text-[10px] text-gray-500">Manut. peq.</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="checkbox" checked={getCardOpts(c.id).pin} onChange={(e) => setCardOpt(c.id, "pin", e.target.checked)} className="w-3 h-3 accent-red-600" />
                              <span className="text-[10px] text-gray-500">PIN</span>
                            </label>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Editor de comentário */}
                  {isEditing && (
                    <div className="bg-purple-50 rounded-md p-4 border border-purple-200 mb-3">
                      <p className="text-xs font-medium text-purple-700 mb-2">Edite o comentário antes de enviar:</p>
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        rows={15}
                        className="w-full border border-purple-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <div className="flex gap-2 mt-3">
                        <WithHelp help="Se 'Complexa' marcado:~1. Muda responsável para Weslley~2. Vencimento +1 dia útil às 22:00~3. Adiciona tag Adequação Complexa~4. Se 'Itens peq.' marcado → adiciona tag / se desmarcado → não adiciona~5. Se 'Manut. peq.' marcado → adiciona tag / se desmarcado → não adiciona~6. Mantém o card na Fase 3~7. Envia o comentário editado|Se 'Complexa' desmarcado:~1. Muda responsável para Weslley~2. Vencimento +2 dias úteis às 22:00~3. Se 'Itens peq.' marcado → adiciona tag / se desmarcado → não adiciona~4. Se 'Manut. peq.' marcado → adiciona tag / se desmarcado → não adiciona~5. Envia o comentário editado~6. Preenche campos obrigatórios (mensagem enviada + revisão realizada)~7. Move o card para a Fase 4">
                          <button onClick={sendRevisaoComment} disabled={updatingCard !== null} className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors">
                            {isUpdating ? "Enviando..." : "Enviar comentário"}
                          </button>
                        </WithHelp>
                        <WithHelp help="Fecha o editor sem enviar alterações">
                          <button onClick={() => setEditingComment(null)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-300 transition-colors">
                            Cancelar
                          </button>
                        </WithHelp>
                      </div>
                      <div className="flex gap-2 mt-3 pt-3 border-t border-purple-200">
                        <CopyScriptPendencias cardTitle={c.title} lastComment={c.lastComment} />
                      </div>
                    </div>
                  )}

                  {/* Editor lateral — só atualizar comentário */}
                  {editingOnlyComment === c.id && (
                    <div className="fixed inset-0 z-50 flex">
                      <div className="w-1/2 bg-black/30" onClick={() => setEditingOnlyComment(null)} />
                      <div className="w-1/2 bg-white shadow-xl p-6 overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-gray-900">Atualizar comentário — {c.title}</h3>
                          <button onClick={() => setEditingOnlyComment(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
                        </div>
                        <div className="mb-3 text-xs text-gray-500">
                          Edite o texto abaixo e envie como novo comentário no card. Não altera vencimento, responsável, tags, campos nem move de fase.
                        </div>
                        <textarea value={onlyCommentText} onChange={(e) => setOnlyCommentText(e.target.value)} rows={25} className="w-full border border-yellow-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-500" />
                        <div className="flex gap-2 mt-4">
                          <WithHelp help="Envia o comentário editado como novo comentário no card do Pipefy">
                            <button onClick={sendOnlyComment} disabled={updatingCard !== null} className="bg-yellow-600 text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-yellow-700 disabled:opacity-50 transition-colors">
                              {isUpdating ? "Enviando..." : "Enviar comentário"}
                            </button>
                          </WithHelp>
                          <WithHelp help="Fecha o editor sem enviar alterações">
                            <button onClick={() => setEditingOnlyComment(null)} className="bg-gray-200 text-gray-700 px-6 py-2.5 rounded-md text-sm font-medium hover:bg-gray-300 transition-colors">
                              Cancelar
                            </button>
                          </WithHelp>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Último comentário */}
                  {c.lastComment && !isEditing && (
                    <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-gray-700">{c.lastCommentAuthor}</span>
                        <span className="text-[10px] text-gray-400">{formatCommentDate(c.lastCommentDate)}</span>
                      </div>
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">{c.lastComment}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

// =====================
// TAB: COMPLEXA (todos os cards com tag Adequação Complexa)
// =====================

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

function TabComplexa() {
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
    return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">Adequação Complexa — Fase 3</h2>
        <p className="text-sm text-gray-500 mb-4">
          Todos os cards da Fase 3 com tag &quot;Adequação Complexa&quot; e o último comentário.
        </p>
        <WithHelp help="Busca todos os cards da Fase 3 com tag Adequação Complexa, independente do vencimento">
          <button onClick={loadCards} disabled={loading} className="bg-gray-600 text-white px-6 py-3 rounded-md font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {loading ? "Carregando..." : `Carregar Cards${cards.length > 0 ? ` (${cards.length})` : ""}`}
          </button>
        </WithHelp>
        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
      </section>

      {cards.length > 0 && (
        <section className="space-y-3">
          {cards.map((c) => (
            <div key={c.id} className="bg-white rounded-lg shadow p-5 border-l-4 border-l-orange-500">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <CopyableCode code={c.title} className="text-base" />
                  <span className="text-xs text-gray-500 ml-3">Vencimento: {c.dueFormatted}</span>
                  {c.assignees.length > 0 && <span className="text-xs text-gray-400 ml-3">{c.assignees.join(", ")}</span>}
                </div>
              </div>
              {c.labels.length > 0 && (
                <div className="flex gap-1 mb-3">
                  {c.labels.map((l) => (
                    <span key={l} className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded">{l}</span>
                  ))}
                </div>
              )}
              {c.lastComment ? (
                <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-gray-700">{c.lastCommentAuthor}</span>
                    <span className="text-[10px] text-gray-400">{formatCommentDate(c.lastCommentDate)}</span>
                  </div>
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">{c.lastComment}</pre>
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

// =====================
// TAB: OCORRÊNCIA / SUPORTES
// =====================

const CATEGORIAS_SUPORTE = [
  "Falta de retorno do franqueado (hóspede, time interno)",
  "Alinhamento com a franquia de uma despesa lançada",
  "Análise de comentários - Dúvidas/Alinhamento com a franquia",
  "Análise de taxa de limpeza",
  "Apoio jurídico/Chargebacks",
  "Busca de fornecedores",
  "Dados franqueado - Solicitar/Alterar dados",
  "Definição de franquia",
  "Dúvidas sobre anúncios",
  "Franquia recusando a executar processos (vistoria, checkin)",
  "Informações referentes a danos",
  "Lançamento de dano Easycover",
  "Questões financeiras da franquia",
  "Reclamação do proprietário sobre o trabalho da franquia",
  "Solicitação de compra de itens/manutenção",
  "Solicitar migração de imóvel",
  "Validação/aprovação/cancelamento de despesas",
  "Validar se uma manutenção já foi feita",
  "Vistoria de migração",
  "Acompanhamento de uma manutenção",
  "Devolução de enxoval (churn/migração)",
  "Problemas operacionais com enxoval",
  "Acessos ao imóvel",
  "Bloqueios de calendário",
];

const SETORES_SUPORTE = [
  "Implantação",
  "Anúncios",
  "Atendimento",
  "B2B",
  "Comercial",
  "CS e Suporte Proprietários",
  "Financeiro e Fechamento",
  "Fornecedores",
  "Franquias",
  "Grandes Operações",
  "Jurídico",
  "Melhoria Contínua",
  "Precificação",
];

const ORIGENS_OCORRENCIA = [
  "Atendimento ao Hóspede",
  "Implantação",
  "Caça Ocorrências",
  "Comentários",
  "Suporte Franquias",
  "Gestor Regional",
  "Danos",
  "Despesas",
  "Manutenções",
  "Outros",
  "Treinamento",
  "Cancelamento de vistorias",
];

function CopyTemplateButton({ label, placeholder, buildText }: { label: string; placeholder: string; buildText: (val: string) => string }) {
  const [val, setVal] = useState("");
  const [copied, setCopied] = useState(false);

  const texto = val ? buildText(val) : "";

  const handleCopy = () => {
    if (!texto) return;
    navigator.clipboard.writeText(texto).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex items-end gap-2">
      <div className="flex-shrink-0">
        <label className="text-xs text-gray-500 block mb-1">{label}</label>
        <input
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={placeholder}
          className="w-24 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
      </div>
      <WithHelp help="Copia o texto gerado para a área de transferência">
        <button
          onClick={handleCopy}
          disabled={!val}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${copied ? "bg-green-600 text-white" : "bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50"}`}
        >
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </WithHelp>
    </div>
  );
}

function CopyDiasTexto() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4">
        <CopyTemplateButton
          label="Dias sem retorno"
          placeholder="Ex: 5"
          buildText={(dias) => `Franquia está a ${dias} dias sem dar retorno, atrasando os processos da implantação.`}
        />
        <CopyTemplateButton
          label="Data prometida"
          placeholder="Ex: 28/03"
          buildText={(data) => `Franquia sinalizou iria enviar os registros pendentes no dia ${data} e não enviou. A falta de retorno da franquia impacta diretamente o tempo de implantação que é um dos KPI importantes para mensurar a produtividade e agilidade da implantação.`}
        />
      </div>
    </div>
  );
}

const AREA_ORIGEM_LOVABLE = [
  "Comentários",
  "Manutenções",
  "Implantação",
  "Gestor Regional",
  "Despesas",
  "Outros",
  "Treinamento",
  "Suporte Franquias",
  "Atendimento ao Hóspede",
  "Danos",
  "Qualidade",
  "Cancelamento de vistorias",
] as const;

interface Subcat {
  id: string;
  codigo: string;
  descricao: string;
  categoria_id: number;
  categoria_nome: string;
  gravidade: string;
  pontos: number;
}
interface Franquia {
  id: string;
  nome: string;
  email: string;
}

function FormOcorrenciaDireta({
  initialCodigo,
  initialFranquia,
  initialDescricao,
}: {
  initialCodigo: string;
  initialFranquia: string;
  initialDescricao: string;
}) {
  const [open, setOpen] = useState(false);

  const [envolveImovel, setEnvolveImovel] = useState(true);
  const [codigo, setCodigo] = useState(initialCodigo);
  const [franquiaNome, setFranquiaNome] = useState(initialFranquia);
  const [areaOrigem, setAreaOrigem] = useState<string>("Implantação");
  const [descricao, setDescricao] = useState(initialDescricao);
  const [subcategoriaId, setSubcategoriaId] = useState<string>("");
  const [evidencia, setEvidencia] = useState<File | null>(null);

  const [subcategorias, setSubcategorias] = useState<Subcat[]>([]);
  const [franquias, setFranquias] = useState<Franquia[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; url?: string } | null>(null);

  useEffect(() => { setCodigo(initialCodigo); }, [initialCodigo]);
  useEffect(() => { setFranquiaNome(initialFranquia); }, [initialFranquia]);
  useEffect(() => { setDescricao(initialDescricao); }, [initialDescricao]);

  const carregarDropdowns = async () => {
    setLoadingDropdowns(true);
    try {
      const [rs, rf] = await Promise.all([
        fetch("/api/lovable/subcategorias"),
        fetch("/api/lovable/franquias"),
      ]);
      if (rs.ok) {
        const subs: Subcat[] = await rs.json();
        setSubcategorias(subs);
        // Pre-seleciona "3.2 — Não responder demandas Sults/Sapron por +2 dias"
        if (!subcategoriaId) {
          const def = subs.find((s) => s.codigo === "3.2");
          if (def) setSubcategoriaId(def.id);
        }
      }
      if (rf.ok) setFranquias(await rf.json());
    } catch { /* silencioso */ }
    finally { setLoadingDropdowns(false); }
  };

  useEffect(() => {
    if (open && subcategorias.length === 0) carregarDropdowns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const subcatSelecionada = subcategorias.find((s) => s.id === subcategoriaId);

  const subcategoriasAgrupadas = subcategorias.reduce<Record<string, Subcat[]>>((acc, s) => {
    if (!acc[s.categoria_nome]) acc[s.categoria_nome] = [];
    acc[s.categoria_nome].push(s);
    return acc;
  }, {});

  const handleEnviar = async () => {
    setSending(true); setResult(null);
    try {
      const fd = new FormData();
      fd.append("email", "weslley.bertoldo@seazone.com.br");
      fd.append("full_name", "Weslley Bertoldo da Silva");
      fd.append("envolve_imovel", String(envolveImovel));
      fd.append("codigo_imovel", codigo.trim().toUpperCase());
      fd.append("franquia_nome", franquiaNome.trim());
      fd.append("area_origem", areaOrigem);
      fd.append("descricao", descricao.trim());
      if (subcatSelecionada) {
        fd.append("subcategoria_codigo", subcatSelecionada.codigo);
        fd.append("subcategoria_descricao", subcatSelecionada.descricao);
        fd.append("subcategoria_categoria", subcatSelecionada.categoria_nome);
        fd.append("subcategoria_gravidade", subcatSelecionada.gravidade);
        fd.append("subcategoria_pontos", String(subcatSelecionada.pontos));
      }
      if (evidencia) fd.append("evidencia", evidencia);

      const r = await fetch("/api/create-ocorrencia-direta", { method: "POST", body: fd });
      const d = await r.json();
      if (d.success) {
        setResult({ success: true, message: `Ocorrência registrada (${d.id?.slice(0, 8)}...)`, url: d.url });
      } else {
        setResult({ success: false, message: d.error || "Erro" });
      }
    } catch (e) {
      setResult({ success: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setSending(false);
    }
  };

  const podeEnviar =
    franquiaNome.trim() &&
    descricao.trim() &&
    subcategoriaId &&
    areaOrigem &&
    (!envolveImovel || codigo.trim());

  return (
    <div className="border-t border-gray-200 pt-4 mb-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-2"
      >
        <span>{open ? "▾" : "▸"}</span> Registrar direto (sem Tampermonkey)
      </button>

      {open && (
        <div className="mt-3 space-y-3 bg-purple-50/40 border border-purple-200 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-700 block mb-1">A reclamação envolve algum imóvel da Seazone? *</label>
              <div className="flex gap-2">
                <button onClick={() => setEnvolveImovel(true)} className={`flex-1 px-3 py-2 rounded-md text-sm font-medium ${envolveImovel ? "bg-purple-600 text-white" : "bg-white border border-gray-300 text-gray-700"}`}>SIM</button>
                <button onClick={() => setEnvolveImovel(false)} className={`flex-1 px-3 py-2 rounded-md text-sm font-medium ${!envolveImovel ? "bg-purple-600 text-white" : "bg-white border border-gray-300 text-gray-700"}`}>NÃO</button>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-700 block mb-1">Código do imóvel{envolveImovel ? " *" : ""}</label>
              <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Ex: ALA0004" disabled={!envolveImovel} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-700 block mb-1">Franquia *</label>
            <input type="text" list="franquias-list" value={franquiaNome} onChange={(e) => setFranquiaNome(e.target.value)} placeholder="Selecione a franquia" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            <datalist id="franquias-list">
              {franquias.map((f) => <option key={f.id} value={f.nome} />)}
            </datalist>
            <p className="text-[10px] text-gray-400 mt-0.5">{franquias.length} franquias carregadas{loadingDropdowns ? " (carregando...)" : ""}</p>
          </div>

          <div>
            <label className="text-xs text-gray-700 block mb-1">Origem da ocorrência *</label>
            <select value={areaOrigem} onChange={(e) => setAreaOrigem(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
              {AREA_ORIGEM_LOVABLE.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-700 block mb-1">Descreva o ocorrido *</label>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="Descreva detalhadamente a ocorrência..." className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>

          <div>
            <label className="text-xs text-gray-700 block mb-1">Subcategoria da ocorrência *</label>
            <select value={subcategoriaId} onChange={(e) => setSubcategoriaId(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
              <option value="">Selecione a subcategoria</option>
              {Object.entries(subcategoriasAgrupadas).map(([cat, subs]) => (
                <optgroup key={cat} label={cat}>
                  {subs.map((s) => (
                    <option key={s.id} value={s.id}>{s.codigo} — {s.descricao} ({s.gravidade}/{s.pontos}p)</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {subcatSelecionada && (
              <p className="text-[10px] text-gray-500 mt-1">Gravidade: <strong>{subcatSelecionada.gravidade}</strong> · Pontos: <strong>{subcatSelecionada.pontos}</strong></p>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-700 block mb-1">Evidência (opcional, max 10MB)</label>
            <input type="file" onChange={(e) => setEvidencia(e.target.files?.[0] || null)} accept="image/*,application/pdf,.doc,.docx" className="w-full text-sm" />
            {evidencia && <p className="text-[10px] text-gray-500 mt-1">{evidencia.name} ({Math.round(evidencia.size / 1024)}KB)</p>}
          </div>

          {result && (
            <div className={`p-3 rounded-md text-sm ${result.success ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              <div>{result.message}</div>
              {result.url && <a href={result.url} target="_blank" rel="noopener" className="text-xs underline mt-1 inline-block break-all">{result.url}</a>}
            </div>
          )}

          <button onClick={handleEnviar} disabled={!podeEnviar || sending} className="w-full bg-purple-600 text-white py-2.5 rounded-md font-medium hover:bg-purple-700 disabled:opacity-50">
            {sending ? "Registrando..." : "Registrar Ocorrência"}
          </button>
        </div>
      )}
    </div>
  );
}

function FormOcorrencia() {
  const [dias, setDias] = useState("");
  const [codigoOcorrencia, setCodigoOcorrencia] = useState("");
  const [franquiaOcorrencia, setFranquiaOcorrencia] = useState("");
  const [loadingFranquia, setLoadingFranquia] = useState(false);
  const [descricaoOcorrencia, setDescricaoOcorrencia] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const buscarFranquia = async () => {
    if (!codigoOcorrencia.trim()) return;
    setLoadingFranquia(true);
    try {
      const res = await fetch(`/api/get-franqueado?code=${encodeURIComponent(codigoOcorrencia.trim())}`);
      const data = await res.json();
      if (data.success && data.franqueado) {
        setFranquiaOcorrencia(data.franqueado);
      } else {
        setFranquiaOcorrencia("");
      }
    } catch {
      setFranquiaOcorrencia("");
    } finally {
      setLoadingFranquia(false);
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const buildOcorrenciaUrl = () => {
    const base = "https://preview--centraldeocorrenciasemultas.lovable.app/adm/funil-ocorrencias";
    const p = new URLSearchParams();
    if (franquiaOcorrencia.trim()) p.set("franquia", franquiaOcorrencia.trim());
    if (codigoOcorrencia.trim()) p.set("codigo", codigoOcorrencia.trim());
    if (descricaoOcorrencia.trim()) p.set("descricao", descricaoOcorrencia.trim());
    const qs = p.toString();
    return qs ? `${base}?${qs}` : base;
  };

  return (
    <section className="bg-white rounded-lg shadow p-6">
      {/* 1. Registrar ocorrência no card */}
      <RegistrarOcorrenciaCard />

      {/* 2. Registrar direto (sem Tampermonkey) */}
      <FormOcorrenciaDireta initialCodigo={codigoOcorrencia} initialFranquia={franquiaOcorrencia} initialDescricao={descricaoOcorrencia} />

      {/* 3. Legacy: Texto de cobrança + Abrir ocorrência (Tampermonkey) */}
      <div className="border-t border-gray-200 pt-4 mt-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Texto de cobrança</h4>
        <div className="flex gap-2 items-end mb-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Quantidade de dias</label>
            <input type="number" value={dias} onChange={(e) => setDias(e.target.value)} placeholder="Ex: 5" className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-24" />
          </div>
          <button
            onClick={() => copyText(`Franquia está a ${dias} dias sem dar retorno, atrasando os processos da implantação.`, "dias")}
            disabled={!dias.trim()}
            className="bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {copied === "dias" ? "Copiado!" : "Copiar texto"}
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex gap-2 items-end">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Código do imóvel</label>
              <input
                type="text"
                value={codigoOcorrencia}
                onChange={(e) => setCodigoOcorrencia(e.target.value.toUpperCase())}
                onBlur={buscarFranquia}
                onKeyDown={(e) => e.key === "Enter" && buscarFranquia()}
                placeholder="Ex: ALA0004"
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-40"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Franquia {loadingFranquia && "(buscando...)"}</label>
              <input
                type="text"
                value={franquiaOcorrencia}
                onChange={(e) => setFranquiaOcorrencia(e.target.value)}
                placeholder="Preenchido automaticamente"
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-64 bg-gray-50"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Descreva o ocorrido</label>
            <textarea
              value={descricaoOcorrencia}
              onChange={(e) => setDescricaoOcorrencia(e.target.value)}
              placeholder="Descreva detalhadamente a ocorrência..."
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <a
              href={buildOcorrenciaUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-purple-600 text-white px-5 py-2.5 rounded-md text-sm font-medium hover:bg-purple-700 transition-colors"
            >
              Abrir ocorrência
            </a>
            <p className="text-xs text-gray-400 mt-1">Tampermonkey preenche: email, SIM, código, franquia, origem, subcategoria e descrição. Evidência: anexar manualmente.</p>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4 mt-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Textos copiar Sults</h4>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => copyText("Ocorrência registrada - Falta de retorno", "falta")}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            {copied === "falta" ? "Copiado!" : "Ocorrência - Falta de retorno"}
          </button>
          <button
            onClick={() => copyText("Ocorrência registrada - Não enviou os registros", "registros")}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            {copied === "registros" ? "Copiado!" : "Ocorrência - Não enviou registros"}
          </button>
        </div>
      </div>
    </section>
  );
}

function TabOcorrenciaSuporte() {
  const [activeForm, setActiveForm] = useState<"suporte" | "ocorrencia" | "anuncio" | "despesa">("suporte");

  return (
    <>
      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Ocorrência / Suportes</h2>
        <div className="flex gap-2 mb-4">
          <WithHelp help="Mostra formulário para criar Suporte Franquias no Pipefy">
            <button
              onClick={() => setActiveForm("suporte")}
              className={`px-5 py-2.5 rounded-md text-sm font-medium transition-colors ${activeForm === "suporte" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
            >
              Suporte Franquias
            </button>
          </WithHelp>
          <WithHelp help="Abre seção de ocorrência: link externo, texto de cobrança, registrar no card e textos para copiar">
            <button
              onClick={() => setActiveForm("ocorrencia")}
              className={`px-5 py-2.5 rounded-md text-sm font-medium transition-colors ${activeForm === "ocorrencia" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
            >
              Ocorrência
            </button>
          </WithHelp>
          <WithHelp help="Mostra formulário para criar card de atualização de anúncio no Pipefy">
            <button
              onClick={() => setActiveForm("anuncio")}
              className={`px-5 py-2.5 rounded-md text-sm font-medium transition-colors ${activeForm === "anuncio" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
            >
              Atualizar Anúncio
            </button>
          </WithHelp>
          <WithHelp help="Envia mensagem de lançamento de despesa no canal #despesas-implantação do Slack">
            <button
              onClick={() => setActiveForm("despesa")}
              className={`px-5 py-2.5 rounded-md text-sm font-medium transition-colors ${activeForm === "despesa" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
            >
              Lançar despesas
            </button>
          </WithHelp>
        </div>
      </section>

      {activeForm === "suporte" && <FormSuporte />}
      {activeForm === "ocorrencia" && <FormOcorrencia />}
      {activeForm === "anuncio" && <FormAtualizarAnuncio />}
      {activeForm === "despesa" && <SlackDespesa />}
    </>
  );
}

const ASSUNTOS_SUPORTE = ["Comunicação", "Enxoval", "Vistoria", "Insatisfação Proprietário"] as const;
const URGENCIAS_SUPORTE = [
  { value: "crise", label: "Crise (4h)" },
  { value: "alta", label: "Alta (12h)" },
  { value: "media", label: "Média (24h)" },
  { value: "baixa", label: "Baixa (24h)" },
] as const;

function saudacaoBR(): string {
  const h = parseInt(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }),
    10
  );
  return h < 12 ? "bom dia" : h < 18 ? "boa tarde" : "boa noite";
}

function FormSuporte() {
  const [codigo, setCodigo] = useState("");
  const [franqueado, setFranqueado] = useState("");
  const [loadingFranqueado, setLoadingFranqueado] = useState(false);
  const [categoria, setCategoria] = useState(CATEGORIAS_SUPORTE[0]);
  const [setor, setSetor] = useState(SETORES_SUPORTE[0]);
  const [assunto, setAssunto] = useState<typeof ASSUNTOS_SUPORTE[number]>("Comunicação");
  const [urgencia, setUrgencia] = useState<string>("media");
  const [descricao, setDescricao] = useState(
    `Pessoal, ${saudacaoBR()}. Tudo bem?\nConseguem nos ajudar com o retorno da franquia?`
  );
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; url?: string } | null>(null);
  const [copiedSuporte, setCopiedSuporte] = useState(false);

  const buscarFranqueado = async () => {
    if (!codigo.trim()) return;
    setLoadingFranqueado(true);
    try {
      const res = await fetch(`/api/get-franqueado?code=${encodeURIComponent(codigo.trim())}`);
      const data = await res.json();
      if (data.franqueado) setFranqueado(data.franqueado);
    } catch { /* silencioso */ }
    finally { setLoadingFranqueado(false); }
  };

  useEffect(() => {
    if (codigo.trim().length >= 3) {
      const timer = setTimeout(buscarFranqueado, 500);
      return () => clearTimeout(timer);
    }
  }, [codigo]);

  const handleEnviar = async () => {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/create-suporte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "weslley.bertoldo@seazone.com.br",
          codigo: codigo.trim(),
          categoria,
          setor,
          descricao: descricao.trim(),
          franqueado,
          assunto,
          urgencia,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ success: true, message: `Suporte criado em suporte-ops`, url: data.url });
        setCodigo("");
        setDescricao(`Pessoal, ${saudacaoBR()}. Tudo bem?\nConseguem nos ajudar com o retorno da franquia?`);
      } else {
        setResult({ success: false, message: data.error || "Erro ao criar" });
      }
    } catch {
      setResult({ success: false, message: "Erro de conexão" });
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="bg-white rounded-lg shadow p-6 mb-6">
      <h3 className="text-lg font-semibold mb-1">Suporte Franquias</h3>
      <p className="text-xs text-gray-500 mb-4">Preencha e clique &quot;Enviar&quot;. O suporte será criado em <code className="text-[11px]">suporte-ops.seazone.properties</code>.</p>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">E-mail solicitante</label>
          <input type="email" value="weslley.bertoldo@seazone.com.br" readOnly className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Código do Imóvel</label>
          <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Ex: ALA0004" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Categoria da solicitação</label>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
            {CATEGORIAS_SUPORTE.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Setor Solicitante</label>
          <select value={setor} onChange={(e) => setSetor(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
            {SETORES_SUPORTE.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Assunto <span className="text-[10px] text-gray-400">(suporte-ops)</span></label>
            <select value={assunto} onChange={(e) => setAssunto(e.target.value as typeof ASSUNTOS_SUPORTE[number])} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
              {ASSUNTOS_SUPORTE.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Urgência</label>
            <select value={urgencia} onChange={(e) => setUrgencia(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
              {URGENCIAS_SUPORTE.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Descrição do Problema</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descreva o problema ou cole o link do chamado..."
            rows={5}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Franqueado</label>
          <input type="text" value={franqueado} onChange={(e) => setFranqueado(e.target.value)} placeholder={loadingFranqueado ? "Buscando..." : "Preenchido automaticamente pelo código"} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <p className="text-[10px] text-gray-400 mt-1">Buscado automaticamente do Pipe 1. Edite se necessário.</p>
        </div>

        {result && (
          <div className={`p-3 rounded-md text-sm ${result.success ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            <div>{result.message}</div>
            {result.url && (
              <a href={result.url} target="_blank" rel="noopener" className="text-xs underline mt-1 inline-block break-all">
                {result.url}
              </a>
            )}
          </div>
        )}

        <WithHelp help="Cria card de Suporte Franquias no suporte-ops.seazone.properties com os dados preenchidos" className="relative w-full">
          <button onClick={handleEnviar} disabled={sending || !codigo.trim()} className="w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {sending ? "Enviando..." : "Enviar Suporte"}
          </button>
        </WithHelp>

        <button
          onClick={() => { navigator.clipboard.writeText("Suporte franquias aberto"); setCopiedSuporte(true); setTimeout(() => setCopiedSuporte(false), 2000); }}
          className="w-full mt-2 bg-gray-100 text-gray-700 py-2.5 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          {copiedSuporte ? "Copiado!" : "Copiar: Suporte franquias aberto"}
        </button>
      </div>
    </section>
  );
}

const FRANQUIAS_OCORRENCIA = ["Adriana Bozeti","Alan Mesquita Maciel","Ana Carla de Aguiar Lopes","Ana Carolina Assmus Barski","Ana Lúcia Gasparello Cruz","Ana Márcia Pereira Buzzacchino","Ana Paula Friedrich de Oliveira","André Demetrio","Andrea Mara dos Santos podlasinski","Andreia Real da Rosa","CAMILA BRESOLIN PEREIRA","Camila Moura Lacerda","Camila Silva Costa","Carlos Eduardo Inácio Diniz","Caroline Sorondo Vaghetti","Cassiana Outeiro Silva de Souza","Christian Cerqueira de Carvalho","Christina Elisabeth Carpes Antunes","Cingridi Cristina Mariano","Cleverson de O. Redivo","Daniela Lopes Nasario","Débora Renata Gomes Soares","Dhennyfer Rosa de Almeida","Diego Rafael Padilha dos Santos","Dineia Pedroso de Almeida","Dreicom Adolfo Neckel Wolter","DRIELY LOHANNE CONSTANTINO","Edilson Machado da Silva","Edite Alves","Eduardo José Pereira Santos","Erion Xhafaj","Evelyn Gabriela dos Santos","Fábio Moreira Campos Monteiro","Fernanda Kieling Kist","Flávio de Souza Porto","Francisco Diey Brito","Gabriela da Luz Nunes","Giselia Soares da Silva","Gladys Timmerman","Glauciene Sacramento Santos","Gustavo Henrique de Barros Silva","Gustavo Ribas","Isadora Corrêa de Oliveira","Itamar Franco Junior","Izana Serra Lima","Jaciane Melo Graciliano","Jane Terezinha de Souza de Jesus","Jayson Luckemeyer","Jeferson Luis Fernandes","Jênifer Niéli Ribas","Jéssica Schirley Sibilio Dutra Jordão Macedo","Jhenyffer Paola Ramos Da Silva","Jocelia de Lima Caron","John Erik Gasparello","José Fernando de Campos","José Ronaldo Cerqueira de Freitas","Juliana Lemos da Silva","Kathellyne Soares de Moraes","Katia Leite do Nascimento Emmel","Kemille Negromonte de Souza","Letícia Fagundes","Luan Navarro","Luanda Tavares Santana","Lucas Sena da Silva","Lucas Taniguti Bertarelli","Luciana Dellamora Pata Fernandes Lima","Lucilene Cora","Luila Chiste Lage","Luís Eduardo Oliveira Machado","Madego DF Ativos","Madego GO Ativos","Marcela S Gambelli","Marcio Nei Schubert Ribas","MARIA CAROLINA DE RODRIGUES DE SOUZA","Mariana Lopes Ribeiro De Carvalho","Mariana Paola Monteiro Ferrari","Matias Clementino Trindade dos Santos","Nabiha Kasmas Denis","Naihana Loyola Andriani","Patrícia Aparecida de Melo","Paulino José Clemente de Vasconcellos","Pedro Henrique Do Erre de Jesus","Rael Michaelsen","Reinaldo Jorge Fernandes","Renata Maria Cerqueira","Ricardo Portella Junior","Roberta de Almeida Turra Vieira","Roberta de Freitas Costa","Rodrigo Maruco Ruas de Oliveira","Sandra Maria Gervásio Sales","Seazone Brasília","Silvia Regina Costa Silva","Sônia Maria Gervásio sales","Stefanie Maria Castro","Thiago Reis","Thiago Rodrigues Pinto","Tiago dos Santos e Santos","Vinicius da Anunciação Santos","Vinicius Vieira dos Reis","Virginia De Paula Carvalho"];

const CATEGORIAS_OCORRENCIA = [
  "Ocorrência com os imóveis",
  "Ocorrência com os hóspedes",
  "Ocorrência com a Seazone",
];

function RegistrarOcorrenciaCard() {
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleRegistrar = async () => {
    if (!code.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/registrar-ocorrencia-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ success: true, message: data.details });
        setCode("");
      } else {
        setResult({ success: false, message: data.error || "Erro" });
      }
    } catch {
      setResult({ success: false, message: "Erro de conexão" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-6 pt-6 border-t border-gray-200">
      <h4 className="text-sm font-semibold text-gray-700 mb-2">Registrar ocorrência no card</h4>
      <p className="text-xs text-gray-500 mb-3">Adiciona &quot;Ocorrência Registrada | DD/MM&quot; abaixo do FUP no último comentário e a tag &quot;OCORRÊNCIA REGISTRADA&quot;.</p>
      <div className="flex gap-2 items-end">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Código do imóvel</label>
          <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ex: ALA0004" className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-40" />
        </div>
        <WithHelp help="1. Busca o card pelo código nas Fases 3, 4 e 5~2. Insere 'Ocorrência Registrada | DD/MM' abaixo da linha de FUP no último comentário~3. Adiciona a tag 'OCORRÊNCIA REGISTRADA' no card (se ainda não tiver)">
          <button onClick={handleRegistrar} disabled={sending || !code.trim()} className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors whitespace-nowrap">
            {sending ? "Registrando..." : "Registrar no card"}
          </button>
        </WithHelp>
        {result && <span className={`text-xs ${result.success ? "text-green-600" : "text-red-600"}`}>{result.message}</span>}
      </div>
    </div>
  );
}

function FormAtualizarAnuncio() {
  const [codigo, setCodigo] = useState("");
  const [tipoAlteracao, setTipoAlteracao] = useState<"Temporária" | "Permanente">("Permanente");
  const [itens, setItens] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const descricao = itens.trim() ? `INCLUIR\n${itens.trim()}` : "";

  const handleEnviar = async () => {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/create-anuncio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: codigo.trim(), tipoAlteracao, descricao }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ success: true, message: `Anúncio criado! Card #${data.cardId}` });
        setCodigo("");
        setItens("");
      } else {
        setResult({ success: false, message: data.error || "Erro ao criar" });
      }
    } catch {
      setResult({ success: false, message: "Erro de conexão" });
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="bg-white rounded-lg shadow p-6 mb-6">
      <h3 className="text-lg font-semibold mb-1">Atualizar Anúncio</h3>
      <p className="text-xs text-gray-500 mb-4">Preencha e clique &quot;Enviar&quot;. O card será criado diretamente no Pipefy.</p>

      <div className="space-y-4">
        <div className="bg-gray-50 rounded-md p-4 border border-gray-200">
          <p className="text-xs text-gray-500 mb-2">Campos preenchidos automaticamente:</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="font-medium text-gray-700">Nome:</span> Weslley Bertoldo da Silva</div>
            <div><span className="font-medium text-gray-700">Email:</span> weslley.bertoldo@seazone.com.br</div>
            <div><span className="font-medium text-gray-700">Vínculo:</span> Time de implantação</div>
            <div><span className="font-medium text-gray-700">Tipo:</span> Informações do imóvel - Ajuste da descrição/ammenites/locomoção</div>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Código do Imóvel</label>
          <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Ex: ALA0004" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Alteração temporária ou permanente?</label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={tipoAlteracao === "Permanente"} onChange={() => setTipoAlteracao("Permanente")} />
              Permanente
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={tipoAlteracao === "Temporária"} onChange={() => setTipoAlteracao("Temporária")} />
              Temporária
            </label>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Itens para incluir</label>
          <p className="text-xs text-gray-500 mb-1">Digite os itens (um por linha). O texto &quot;INCLUIR&quot; será adicionado automaticamente.</p>
          <textarea value={itens} onChange={(e) => setItens(e.target.value)} placeholder={"Ferro de passar\nTábua de roupas\nSecador de cabelo"} rows={5} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {descricao && (
          <div className="bg-green-50 rounded-md p-4 border border-green-200">
            <p className="text-xs font-medium text-green-700 mb-2">Descrição que será enviada:</p>
            <pre className="text-xs text-green-900 whitespace-pre-wrap font-sans">{descricao}</pre>
          </div>
        )}

        {result && (
          <div className={`p-3 rounded-md text-sm ${result.success ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {result.message}
          </div>
        )}

        <WithHelp help="Cria card de atualização de anúncio no Pipefy com os itens para incluir" className="relative w-full">
          <button onClick={handleEnviar} disabled={sending || !codigo.trim() || !itens.trim()} className="w-full bg-green-600 text-white py-3 rounded-md font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
            {sending ? "Enviando..." : "Enviar Atualização de Anúncio"}
          </button>
        </WithHelp>
      </div>
    </section>
  );
}

function FormOcorrenciaLegacy() {
  const [codigo, setCodigo] = useState("");
  const [franquia, setFranquia] = useState("");
  const [origem, setOrigem] = useState("Implantação");
  const [descricao, setDescricao] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleEnviar = async () => {
    setSending(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("email", "weslley.bertoldo@seazone.com.br");
      formData.append("envolveimovel", "Sim");
      formData.append("codigo", codigo.trim());
      formData.append("franquia", franquia);
      formData.append("origem", origem);
      formData.append("descricao", descricao.trim());
      if (file) formData.append("evidencia", file);

      const res = await fetch("/api/create-ocorrencia", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setResult({ success: true, message: `Ocorrência criada! Card #${data.cardId}` });
        setCodigo("");
        setDescricao("");
        setFile(null);
        if (fileRef.current) fileRef.current.value = "";
      } else {
        setResult({ success: false, message: data.error || "Erro ao criar" });
      }
    } catch {
      setResult({ success: false, message: "Erro de conexão" });
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="bg-white rounded-lg shadow p-6 mb-6">
      <h3 className="text-lg font-semibold mb-1">Registro de Ocorrência</h3>
      <p className="text-xs text-gray-500 mb-4">Preencha e clique &quot;Enviar&quot;. A ocorrência será criada diretamente no Pipefy.</p>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">E-mail Seazone do solicitante</label>
          <input type="email" value="weslley.bertoldo@seazone.com.br" readOnly className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">A reclamação envolve algum imóvel da Seazone?</label>
          <input type="text" value="Sim" readOnly className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Código do Imóvel</label>
          <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Ex: ALA0004" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>


        <SearchableSelect
          label="Franquia do imóvel"
          value={franquia}
          onChange={setFranquia}
          options={FRANQUIAS_OCORRENCIA}
          placeholder="Digite para pesquisar..."
        />

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Origem da ocorrência</label>
          <select value={origem} onChange={(e) => setOrigem(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
            {ORIGENS_OCORRENCIA.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Descreva o ocorrido</label>
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreva o ocorrido..." rows={5} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Evidência (print/arquivo)</label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
          />
          {file && <p className="text-xs text-gray-500 mt-1">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>}
        </div>

        {result && (
          <div className={`p-3 rounded-md text-sm ${result.success ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {result.message}
          </div>
        )}

        <WithHelp help="Cria card de Ocorrência diretamente no Pipefy com os dados e evidência anexada" className="relative w-full">
          <button onClick={handleEnviar} disabled={sending || !codigo.trim() || !descricao.trim() || !franquia} className="w-full bg-orange-600 text-white py-3 rounded-md font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors">
            {sending ? "Enviando..." : "Enviar Ocorrência"}
          </button>
        </WithHelp>
      </div>

      {/* Registrar ocorrência no card */}
      <RegistrarOcorrenciaCard />
    </section>
  );
}

// =====================
// TAB: ENXOVAL/CSO
// =====================

interface EnxovalCsoCard {
  id: string;
  title: string;
  lastComment: string;
  tags: string[];
  hasEnxovalComprado: boolean;
  hasCompraPropria: boolean;
  enxovalType: "comprado" | "propria" | "pendente";
}

function TabEnxovalCso() {
  const [cards, setCards] = useState<EnxovalCsoCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatingCard, setUpdatingCard] = useState<string | null>(null);
  const [cardStatuses, setCardStatuses] = useState<Record<string, { status: "updated" | "error"; message: string }>>({});

  const loadCards = async () => {
    setLoading(true);
    setError("");
    setCardStatuses({});
    try {
      const res = await fetch("/api/enxoval-cso");
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

  const updateCard = async (code: string, enxovalType: string) => {
    setUpdatingCard(code);
    try {
      const res = await fetch("/api/enxoval-cso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, enxovalType }),
      });
      const data = await res.json();
      if (data.success) {
        setCardStatuses((prev) => ({ ...prev, [code]: { status: "updated", message: data.details } }));
      } else {
        setCardStatuses((prev) => ({ ...prev, [code]: { status: "error", message: data.error || "Erro" } }));
      }
    } catch {
      setCardStatuses((prev) => ({ ...prev, [code]: { status: "error", message: "Erro de conexão" } }));
    } finally {
      setUpdatingCard(null);
    }
  };

  return (
    <>
      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">ENXOVAL / CSO</h2>
        <p className="text-sm text-gray-500 mb-4">
          Cards da Fase 5 com enxoval pendente (❌ ENXOVAL). Mostra as tags do Pipe 0 (Onboarding). O botão atualiza o comentário e campo &quot;Validação Enxoval&quot; para &quot;COMPRADO - PP CSO&quot;.
        </p>
        <WithHelp help="Busca cards da Fase 5 com enxoval pendente (❌ ENXOVAL) e mostra tags do Pipe 0 (Onboarding)">
          <button onClick={loadCards} disabled={loading} className="bg-gray-600 text-white px-6 py-3 rounded-md font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {loading ? "Carregando..." : `Carregar Cards${cards.length > 0 ? ` (${cards.length})` : ""}`}
          </button>
        </WithHelp>
        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
      </section>

      {cards.length > 0 && (
        <section className="space-y-3">
          {cards.map((c) => {
            const cardStatus = cardStatuses[c.title];
            const isUpdating = updatingCard === c.title;
            return (
              <div key={c.id} className={`bg-white rounded-lg shadow p-5 border-l-4 ${cardStatus?.status === "updated" ? "border-l-green-500" : cardStatus?.status === "error" ? "border-l-red-500" : "border-l-red-400"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <CopyableCode code={c.title} className="text-base" />
                    <span className="text-xs text-red-500 font-medium">❌ ENXOVAL pendente</span>
                    {c.tags.map((t) => (
                      <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded ${t.toUpperCase().includes("ENXOVAL") ? "bg-green-200 text-green-800" : "bg-gray-200"}`}>{t}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    {cardStatus && (
                      <span className={`text-xs ${cardStatus.status === "updated" ? "text-green-600" : "text-red-600"}`}>{cardStatus.message}</span>
                    )}
                    {!cardStatus && (
                      <WithHelp help="1. Busca o último comentário do card~2. Substitui a linha '❌ ENXOVAL' pelo novo status (COMPRADO PP CSO ou PROP COMPROU POR CONTA PRÓPRIA)~3. Adiciona o comentário atualizado no card~4. Atualiza o campo 'Validação Enxoval' no Pipefy com o mesmo status">
                        <button
                          onClick={() => updateCard(c.title, c.enxovalType)}
                          disabled={isUpdating || updatingCard !== null}
                          className="bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          {isUpdating ? "Atualizando..." : "Atualizar Info Enxoval"}
                        </button>
                      </WithHelp>
                    )}
                  </div>
                </div>

                {/* Último comentário */}
                {c.lastComment && (
                  <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">{c.lastComment}</pre>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}

// =====================
// COMPONENTE: Pesquisa global
// =====================

function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<{ id: string; title: string; phase: string; dueFormatted: string }[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setResults(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const search = async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/search-global?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      setResults(data.success ? data.cards : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <div className="flex gap-1.5">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Pesquisar código..."
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
        />
        <button
          onClick={search}
          disabled={searching || query.trim().length < 2}
          className="bg-blue-500 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          {searching ? "..." : "Buscar"}
        </button>
      </div>
      {results !== null && (
        <div className="absolute top-full mt-1 right-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 w-80 max-h-72 overflow-y-auto">
          {results.length === 0 ? (
            <p className="text-sm text-gray-400 p-4 text-center">Nenhum card encontrado</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {results.map((c) => (
                <div key={c.id} className="px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-gray-900">{c.title}</span>
                    <span className="text-[10px] text-gray-400">#{c.id}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">{c.phase}</span>
                    <span className="text-xs text-gray-500">Vencimento: {c.dueFormatted}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =====================
// MAIN APP
// =====================

function getNextBusinessDays(count: number): { date: string; label: string; weekday: string }[] {
  const days: { date: string; label: string; weekday: string }[] = [];
  const weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const d = new Date();
  while (days.length < count) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      days.push({
        date: `${yyyy}-${mm}-${dd}`,
        label: `${dd}/${mm}`,
        weekday: weekdays[d.getDay()],
      });
    }
  }
  return days;
}

function TabCardsAll() {
  const [filterDate, setFilterDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [cards, setCards] = useState<{ id: string; title: string; phase: string; dueFormatted: string; assignees: string[]; labels: string[] }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Alteração em lote
  const [batchDate, setBatchDate] = useState("");
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchResults, setBatchResults] = useState<{ cardId: string; title: string; status: "pending" | "processing" | "updated" | "error"; message: string }[]>([]);

  // Alteração individual
  const [individualDates, setIndividualDates] = useState<Record<string, string>>({});
  const [individualUpdating, setIndividualUpdating] = useState<string | null>(null);
  const [individualStatuses, setIndividualStatuses] = useState<Record<string, { status: "updated" | "error"; message: string }>>({});

  const loadCards = async () => {
    setLoading(true);
    setError("");
    setCards([]);
    setBatchResults([]);
    setIndividualStatuses({});
    try {
      const res = await fetch(`/api/cards-by-date?date=${filterDate}`);
      const data = await res.json();
      if (data.success) {
        setCards(data.cards);
      } else {
        setError(data.error || "Erro");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  const changeBatchDate = async () => {
    if (!batchDate || cards.length === 0) return;
    setBatchProcessing(true);
    const initial = cards.map((c) => ({ cardId: c.id, title: c.title, status: "pending" as const, message: "" }));
    setBatchResults(initial);

    for (let i = 0; i < cards.length; i++) {
      setBatchResults((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "processing", message: "Processando..." } : r));
      try {
        const res = await fetch("/api/cards-by-date", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId: cards[i].id, newDate: batchDate }),
        });
        const data = await res.json();
        if (data.success) {
          setBatchResults((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "updated", message: data.details } : r));
        } else {
          setBatchResults((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "error", message: data.error || "Erro" } : r));
        }
      } catch {
        setBatchResults((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "error", message: "Erro de conexão" } : r));
      }
    }
    setBatchProcessing(false);
  };

  const changeIndividualDate = async (cardId: string) => {
    const newDate = individualDates[cardId];
    if (!newDate) return;
    setIndividualUpdating(cardId);
    try {
      const res = await fetch("/api/cards-by-date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, newDate }),
      });
      const data = await res.json();
      if (data.success) {
        setIndividualStatuses((prev) => ({ ...prev, [cardId]: { status: "updated", message: data.details } }));
      } else {
        setIndividualStatuses((prev) => ({ ...prev, [cardId]: { status: "error", message: data.error || "Erro" } }));
      }
    } catch {
      setIndividualStatuses((prev) => ({ ...prev, [cardId]: { status: "error", message: "Erro de conexão" } }));
    } finally {
      setIndividualUpdating(null);
    }
  };

  const phaseColor: Record<string, string> = { "Fase 3": "bg-blue-100 text-blue-700", "Fase 4": "bg-orange-100 text-orange-700", "Fase 5": "bg-green-100 text-green-700" };

  return (
    <section className="space-y-4">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-2">Cards All / Por dia</h2>
        <p className="text-sm text-gray-500 mb-4">Visualize e altere o vencimento de cards das Fases 3, 4 e 5</p>

        <div className="flex gap-2 items-center flex-wrap">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={loadCards}
            disabled={loading}
            className="bg-gray-600 text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Carregando..." : "Buscar Cards"}
          </button>

          {cards.length > 0 && (
            <>
              <div className="h-6 w-px bg-gray-300 mx-1" />
              <input
                type="date"
                value={batchDate}
                onChange={(e) => setBatchDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button
                onClick={changeBatchDate}
                disabled={batchProcessing || !batchDate}
                className="bg-red-600 text-white px-4 py-2.5 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {batchProcessing ? "Alterando..." : `Alterar todos (${cards.length}) para nova data`}
              </button>
            </>
          )}
        </div>
        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
      </div>

      {/* Resultados do lote */}
      {batchResults.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Resultado da alteração em lote</h3>
            <button onClick={() => setBatchResults([])} className="text-xs text-blue-600 hover:text-blue-800">Voltar à lista</button>
          </div>
          <div className="space-y-1">
            {batchResults.map((r) => (
              <div key={r.cardId} className="flex items-center justify-between px-3 py-2 rounded-md border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{r.status === "updated" ? "✅" : r.status === "error" ? "❌" : r.status === "processing" ? "⏳" : "⏸️"}</span>
                  <span className="text-sm font-mono font-bold">{r.title}</span>
                </div>
                <span className={`text-xs ${r.status === "updated" ? "text-green-600" : r.status === "error" ? "text-red-600" : "text-gray-500"}`}>
                  {r.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de cards */}
      {cards.length > 0 && batchResults.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold mb-3">{cards.length} cards com vencimento em {filterDate.split("-").reverse().join("/")}</h3>
          <div className="space-y-1">
            {cards.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-md border border-gray-200 bg-gray-50 gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${phaseColor[c.phase] || "bg-gray-100 text-gray-600"}`}>{c.phase}</span>
                  <CopyableCode code={c.title} className="text-sm" />
                  <span className="text-[10px] text-gray-400 truncate">{c.assignees.join(", ")}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {individualStatuses[c.id] ? (
                    <span className={`text-xs ${individualStatuses[c.id].status === "updated" ? "text-green-600" : "text-red-600"}`}>
                      {individualStatuses[c.id].message}
                    </span>
                  ) : (
                    <>
                      <input
                        type="date"
                        value={individualDates[c.id] || ""}
                        onChange={(e) => setIndividualDates((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        className="border border-gray-300 rounded px-1.5 py-1 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => changeIndividualDate(c.id)}
                        disabled={individualUpdating === c.id || !individualDates[c.id]}
                        className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
                      >
                        {individualUpdating === c.id ? "..." : "Alterar"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {cards.length === 0 && !loading && !error && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-400 text-center">Selecione uma data e clique em "Buscar Cards"</p>
        </div>
      )}
    </section>
  );
}

function TabSlackHistory() {
  const [messages, setMessages] = useState<{ ts: string; text: string; date: string; botMessage: boolean }[]>([]);
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
    return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
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
            // Extrair código do imóvel da mensagem
            const codeMatch = m.text.match(/imóvel\s+(\S+)/i) || m.text.match(/despesa\s*-\s*(\S+)/i);
            const code = codeMatch?.[1]?.replace(/[*_]/g, "") || "";
            const firstLine = m.text.split("\n")[0].replace(/<@[^>]+>/g, "").replace(/\*/g, "").trim();
            const isFinished = m.text.includes("finalizado") || m.text.includes("✅");
            return (
              <div key={m.ts} className="flex items-center justify-between px-3 py-2 rounded-md border border-gray-200 bg-gray-50 gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{formatDate(m.date)}</span>
                  {code && <span className="text-xs font-mono font-bold text-gray-800 flex-shrink-0">{code}</span>}
                  <span className={`text-xs truncate ${isFinished ? "text-green-600" : "text-gray-500"}`}>
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
        <p className="text-sm text-gray-400 text-center py-4">Clique em "Carregar Mensagens" para ver o histórico</p>
      )}
    </section>
  );
}

function TabCardsGerais() {
  const [searchCode, setSearchCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [cards, setCards] = useState<{ id: string; title: string; phase: string; phaseId: string; dueFormatted: string; due_date: string; assignees: { id: string; name: string }[]; labels: { id: string; name: string }[]; lastComment: string; lastCommentAuthor: string }[]>([]);
  const [error, setError] = useState("");
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [editComment, setEditComment] = useState("");
  const [editLabels, setEditLabels] = useState<{ id: string; name: string }[]>([]);
  const [editDueDate, setEditDueDate] = useState("");
  const [editAssigneeId, setEditAssigneeId] = useState("");
  const [editMovePhase, setEditMovePhase] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateResults, setUpdateResults] = useState<{ action: string; status: string; message: string }[]>([]);

  const ALL_PHASES = [
    { id: "323529355", name: "Fase 0" },
    { id: "323315791", name: "Fase 1" },
    { id: "323529394", name: "Fase 2" },
    { id: "323529403", name: "Fase 3" },
    { id: "333848207", name: "Fase 4" },
    { id: "333848127", name: "Fase 5" },
    { id: "323315793", name: "Concluído" },
    { id: "323691490", name: "CHURN" },
    { id: "329664300", name: "Excluídos" },
  ];

  const ALL_TAGS = [
    { id: "310425316", name: "Comprar enxoval" },
    { id: "310938829", name: "Entregar enxoval" },
    { id: "310959732", name: "Validar enxoval" },
    { id: "310938809", name: "Itens pequenos" },
    { id: "310938821", name: "Manutenções pequenas" },
    { id: "310425321", name: "Itens grandes" },
    { id: "310425328", name: "Manutenções grandes" },
    { id: "314328534", name: "Adequação complexa" },
    { id: "312148103", name: "📌 PIN" },
    { id: "314401573", name: "Revisão Finalizada" },
    { id: "314317045", name: "Imóvel Ativo" },
    { id: "315919223", name: "OCORRÊNCIA REGISTRADA" },
    { id: "314342772", name: "🚨 POSSÍVEL CHURN" },
    { id: "314377384", name: "⚠️ prioridade!" },
  ];

  const searchCard = async () => {
    if (!searchCode.trim()) return;
    setSearching(true);
    setError("");
    setCards([]);
    setEditingCard(null);
    setUpdateResults([]);
    try {
      const res = await fetch(`/api/cards-gerais?q=${encodeURIComponent(searchCode.trim())}`);
      const data = await res.json();
      if (data.success) {
        setCards(data.cards);
        if (data.cards.length === 0) setError("Nenhum card encontrado");
      } else {
        setError(data.error || "Erro");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setSearching(false);
    }
  };

  const openEditor = (card: any) => {
    setEditingCard(card.id);
    setEditComment(card.lastComment || "");
    setEditLabels([...card.labels]);
    setEditDueDate(card.due_date ? card.due_date.split("T")[0] : "");
    setEditAssigneeId("");
    setEditMovePhase("");
    setUpdateResults([]);
  };

  const removeLabel = (labelId: string) => {
    setEditLabels((prev) => prev.filter((l) => l.id !== labelId));
  };

  const addLabel = (tag: { id: string; name: string }) => {
    if (!editLabels.some((l) => l.id === tag.id)) {
      setEditLabels((prev) => [...prev, tag]);
    }
  };

  const sendUpdate = async (cardId: string) => {
    setUpdating(true);
    setUpdateResults([]);
    try {
      const actions: any = {};
      if (editComment.trim()) actions.comment = editComment;
      actions.labelIds = editLabels.map((l) => l.id);
      if (editDueDate) actions.dueDate = editDueDate;
      if (editAssigneeId) actions.assigneeId = editAssigneeId;
      if (editMovePhase) actions.moveToPhaseId = editMovePhase;

      const res = await fetch("/api/cards-gerais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, actions }),
      });
      const data = await res.json();
      setUpdateResults(data.results || []);
    } catch {
      setUpdateResults([{ action: "Geral", status: "error", message: "Erro de conexão" }]);
    } finally {
      setUpdating(false);
    }
  };

  const phaseColor: Record<string, string> = {
    "Fase 0": "bg-gray-100 text-gray-600",
    "Fase 1": "bg-gray-100 text-gray-600",
    "Fase 2": "bg-purple-100 text-purple-700",
    "Fase 3": "bg-blue-100 text-blue-700",
    "Fase 4": "bg-orange-100 text-orange-700",
    "Fase 5": "bg-green-100 text-green-700",
    "Concluído": "bg-emerald-100 text-emerald-700",
    "CHURN": "bg-red-100 text-red-700",
    "Excluídos": "bg-red-100 text-red-700",
  };

  const getReturnPhases = (currentPhaseId: string) => {
    const idx = ALL_PHASES.findIndex((p) => p.id === currentPhaseId);
    if (idx <= 0) return [];
    return ALL_PHASES.slice(0, idx);
  };

  const getAdvancePhases = (currentPhaseId: string) => {
    const advanceIds = ["323529403", "333848207", "333848127"];
    if (!advanceIds.includes(currentPhaseId)) return [];
    const idx = ALL_PHASES.findIndex((p) => p.id === currentPhaseId);
    if (idx < 0 || idx >= ALL_PHASES.length - 1) return [];
    return [ALL_PHASES[idx + 1]];
  };

  return (
    <section className="space-y-4">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-2">Cards Gerais — Pesquisa no Pipe inteiro</h2>
        <p className="text-sm text-gray-500 mb-4">Busca em todas as fases (0 a 5, Concluído, CHURN, Excluídos)</p>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && searchCard()}
            placeholder="Código do card..."
            className="border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />
          <button
            onClick={searchCard}
            disabled={searching || !searchCode.trim()}
            className="bg-gray-600 text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {searching ? "Buscando..." : "Pesquisar"}
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
      </div>

      {cards.map((c) => (
        <div key={c.id} className="bg-white rounded-lg shadow p-5 border-l-4 border-l-gray-400">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${phaseColor[c.phase] || "bg-gray-100 text-gray-600"}`}>{c.phase}</span>
              <CopyableCode code={c.title} className="text-base" />
              <span className="text-xs text-gray-500">Venc: {c.due_date ? c.due_date.split("T")[0].split("-").reverse().join("/") : "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{c.assignees.map((a) => a.name).join(", ") || "Sem responsável"}</span>
              {editingCard !== c.id && (
                <button
                  onClick={() => openEditor(c)}
                  className="bg-yellow-500 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-yellow-600 transition-colors"
                >
                  Editar
                </button>
              )}
            </div>
          </div>

          {/* Editor */}
          {editingCard === c.id && (
            <div className="bg-gray-50 rounded-md p-4 border border-gray-200 space-y-3">
              {/* Tags como badges com ✕ */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Tags:</p>
                <div className="flex flex-wrap gap-1 items-center">
                  {editLabels.map((l) => (
                    <span key={l.id} className="inline-flex items-center gap-1 text-[10px] bg-gray-200 px-2 py-0.5 rounded-full">
                      {l.name}
                      <button onClick={() => removeLabel(l.id)} className="text-red-400 hover:text-red-600 font-bold">✕</button>
                    </span>
                  ))}
                  <div className="relative group">
                    <button className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full hover:bg-blue-200">+ Tag</button>
                    <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 w-48 max-h-48 overflow-y-auto hidden group-hover:block">
                      {ALL_TAGS.filter((t) => !editLabels.some((l) => l.id === t.id)).map((t) => (
                        <button key={t.id} onClick={() => addLabel(t)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 transition-colors">
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Comentário */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Comentário:</p>
                <textarea
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  rows={10}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Vencimento + Responsável */}
              <div className="flex gap-3 flex-wrap">
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">Vencimento:</p>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">Responsável:</p>
                  <select
                    value={editAssigneeId}
                    onChange={(e) => setEditAssigneeId(e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Não alterar</option>
                    <option value="305932218">Weslley Bertoldo</option>
                  </select>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">Mudar fase:</p>
                  <select
                    value={editMovePhase}
                    onChange={(e) => setEditMovePhase(e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Não alterar</option>
                    {getReturnPhases(c.phaseId).length > 0 && (
                      <optgroup label="↩ Retornar">
                        {getReturnPhases(c.phaseId).map((p) => (
                          <option key={p.id} value={p.id}>← {p.name}</option>
                        ))}
                      </optgroup>
                    )}
                    {getAdvancePhases(c.phaseId).length > 0 && (
                      <optgroup label="→ Avançar">
                        {getAdvancePhases(c.phaseId).map((p) => (
                          <option key={p.id} value={p.id}>→ {p.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-2">
                <button
                  onClick={() => sendUpdate(c.id)}
                  disabled={updating}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {updating ? "Enviando..." : "Enviar alterações"}
                </button>
                <button
                  onClick={() => { setEditingCard(null); setUpdateResults([]); }}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-300 transition-colors"
                >
                  Cancelar
                </button>
              </div>

              {/* Resultados */}
              {updateResults.length > 0 && (
                <div className="space-y-1 mt-2">
                  {updateResults.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span>{r.status === "ok" ? "✅" : "❌"}</span>
                      <span className="font-medium">{r.action}:</span>
                      <span className={r.status === "ok" ? "text-green-600" : "text-red-600"}>{r.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Último comentário (quando não editando) */}
          {editingCard !== c.id && c.lastComment && (
            <div className="bg-gray-50 rounded-md p-3 border border-gray-200 mt-2">
              <p className="text-xs text-gray-400 mb-1">{c.lastCommentAuthor}</p>
              <p className="text-xs text-gray-600 whitespace-pre-wrap max-h-32 overflow-y-auto">{c.lastComment}</p>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function DaySummary() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const [allDays] = useState(() => {
    const now = new Date();
    const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const todayLabel = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}`;
    const todayWeekday = weekdays[now.getDay()];
    const nextDays = getNextBusinessDays(4);
    return [{ date: todayDate, label: todayLabel, weekday: todayWeekday, isToday: true }, ...nextDays.map((d) => ({ ...d, isToday: false }))];
  });

  useEffect(() => {
    const dates = allDays.map((d) => d.date).join(",");
    fetch(`/api/cards-by-date?countOnly=true&dates=${dates}`)
      .then((r) => r.json())
      .then((data) => { if (data.success) setCounts(data.counts); })
      .catch((err) => console.error("Erro ao carregar contagens:", err))
      .finally(() => setLoading(false));
  }, [allDays]);

  return (
    <div className="flex gap-1">
      {allDays.map((d) => (
        <div key={d.date} className={`text-center rounded-md px-2 py-1 min-w-[58px] border ${d.isToday ? "bg-blue-50 border-blue-300" : "bg-gray-50 border-gray-200"}`}>
          <div className={`text-[9px] font-medium uppercase ${d.isToday ? "text-blue-600" : "text-gray-500"}`}>{d.isToday ? "Hoje" : d.weekday}</div>
          <div className={`text-[10px] ${d.isToday ? "text-blue-700" : "text-gray-700"}`}>{d.label}</div>
          <div className={`text-base font-bold ${d.isToday ? "text-blue-900" : "text-gray-900"}`}>{loading ? "..." : counts[d.date] ?? 0}</div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<"fase3" | "fase4" | "revisao" | "fase5" | "processamento" | "ocorrencia" | "enxovalcso" | "complexa" | "cardsall" | "slackhistory" | "cardsgerais">("fase3");
  const [activeSection, setActiveSection] = useState<"enxoval" | "troca">(() => {
    if (typeof window === "undefined") return "enxoval";
    const v = window.localStorage.getItem("activeSection");
    return v === "troca" ? "troca" : "enxoval";
  });
  const [showSectionPopover, setShowSectionPopover] = useState(false);

  // Persiste a aba escolhida (Pipefy Enxoval vs Troca de Código) entre reloads
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("activeSection", activeSection);
    }
  }, [activeSection]);

  // Fechar popover ao clicar fora
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Não fechar se clicou dentro do popover ou no botão trigger
      if (target.closest(".section-popover-content")) return;
      if (!target.closest(".section-popover-trigger")) {
        setShowSectionPopover(false);
      }
    };
    if (showSectionPopover) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [showSectionPopover]);

  // Verificar auth ao carregar
  useEffect(() => {
    fetch("/api/auth")
      .then((res) => res.json())
      .then((data) => setAuthenticated(data.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setAuthenticated(false);
  };

  // Loading
  if (authenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  // Login
  if (!authenticated) {
    return <LoginScreen onLogin={() => setAuthenticated(true)} />;
  }

  // Dashboard
  return (
    <div className="max-w-4xl mx-auto p-6">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          {/* Título clicável com popover */}
          <div className="relative">
            <button
              onClick={() => setShowSectionPopover(!showSectionPopover)}
              className="section-popover-trigger text-3xl font-bold text-gray-900 hover:text-blue-600 transition-colors flex items-center gap-2"
            >
              <span>{activeSection === "enxoval" ? "Pipefy Enxoval" : "Troca de Código"}</span>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {/* Popover */}
            {showSectionPopover && (
              <div className="section-popover-content absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 min-w-[200px]">
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveSection("enxoval"); setShowSectionPopover(false); }}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${activeSection === "enxoval" ? "bg-blue-50 text-blue-700" : "text-gray-700"}`}
                >
                  <div className="font-medium">Pipefy Enxoval</div>
                  <div className="text-xs text-gray-500 mt-0.5">Automação enxoval — Seazone</div>
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveSection("troca"); setShowSectionPopover(false); }}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${activeSection === "troca" ? "bg-blue-50 text-blue-700" : "text-gray-700"}`}
                >
                  <div className="font-medium">Troca de Código</div>
                  <div className="text-xs text-gray-500 mt-0.5">Automação troca de código — Seazone</div>
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <DaySummary />
            <GlobalSearch />
            <WithHelp help="Faz logout e volta para a tela de login">
              <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                Sair
              </button>
            </WithHelp>
          </div>
        </div>
      </header>

      {/* Conteúdo da seção selecionada */}
      {activeSection === "enxoval" ? (
        <>
          {/* Tabs */}
          <div className="mb-6 bg-gray-100 p-1 rounded-lg space-y-px">
        <div className="flex gap-1">
          {([
            { id: "fase3", label: "Fase 3", help: "Atualiza vencimento e comentário dos cards da Fase 3 com vencimento para hoje" },
            { id: "fase4", label: "Fase 4", help: "Atualiza vencimento +2 dias úteis e comentário dos cards da Fase 4" },
            { id: "revisao", label: "Complexa/Revisão finalizada", help: "Cards com tag Adequação Complexa ou Revisão de Pendências Finalizada na Fase 3" },
            { id: "fase5", label: "Fase 5", help: "Cards da Fase 5 com comentários, atualização individual e finalização" },
          ] as { id: typeof activeTab; label: string; help: string }[]).map((tab) => (
            <WithHelp key={tab.id} help={tab.help} className="relative flex-1">
              <button
                onClick={() => setActiveTab(tab.id)}
                className={`w-full py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            </WithHelp>
          ))}
        </div>
        <hr className="border-gray-200" />
        <div className="flex gap-1">
          {([
            { id: "processamento", label: "Processamento", help: "Registro de enxoval para cards da Fase 5 sem registro" },
            { id: "ocorrencia", label: "Ocorrência/Suportes", help: "Formulários para criar ocorrências, suportes e atualizações de anúncio no Pipefy" },
            { id: "enxovalcso", label: "ENXOVAL/CSO", help: "Cards da Fase 5 com enxoval pendente — atualiza para COMPRADO PP CSO" },
            { id: "complexa", label: "Complexa", help: "Lista todos os cards com tag Adequação Complexa na Fase 3, independente do vencimento" },
          ] as { id: typeof activeTab; label: string; help: string }[]).map((tab) => (
            <WithHelp key={tab.id} help={tab.help} className="relative flex-1">
              <button
                onClick={() => setActiveTab(tab.id)}
                className={`w-full py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            </WithHelp>
          ))}
        </div>
        <hr className="border-gray-200" />
        <div className="flex gap-1">
          {([
            { id: "cardsall", label: "Cards All / Por dia", help: "Visão geral de todos os cards por dia" },
            { id: "slackhistory", label: "Histórico Pedidos Slack", help: "Mensagens enviadas no canal #despesas-implantação — com opção de excluir" },
            { id: "cardsgerais", label: "Cards Gerais", help: "Pesquisa e edição de cards em todas as fases do pipe" },
          ] as { id: typeof activeTab; label: string; help: string }[]).map((tab) => (
            <WithHelp key={tab.id} help={tab.help} className="relative flex-1">
              <button
                onClick={() => setActiveTab(tab.id)}
                className={`w-full py-1.5 px-4 rounded-md text-xs font-medium transition-colors ${
                  activeTab === tab.id ? "bg-gray-800 text-gray-100 shadow-sm" : "text-gray-500 hover:text-gray-700 bg-gray-200"
                }`}
              >
                {tab.label}
              </button>
            </WithHelp>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "fase3" && <TabUpdateCards apiRoute="/api/update-cards" phaseName="Fase 3" phaseDescription={'Atualiza vencimento para o próximo dia útil às 22:00, responsável para Weslley Bertoldo, e replica o último comentário com a nova data. Cards com tags "Adequação Complexa" ou "Revisão de Pendências Finalizada" são ignorados.'} />}
      {activeTab === "fase4" && <TabUpdateCards apiRoute="/api/update-cards-phase4" phaseName="Fase 4" phaseDescription="Atualiza vencimento para daqui a 2 dias úteis às 22:00 e replica o último comentário com a nova data. Só atualiza cards do Weslley com vencimento para hoje." showCopyButton />}
      {activeTab === "revisao" && <TabRevisao />}
      {activeTab === "fase5" && <TabPhase5 />}
      {activeTab === "processamento" && <TabProcessamento />}
      {activeTab === "ocorrencia" && <TabOcorrenciaSuporte />}
      {activeTab === "enxovalcso" && <TabEnxovalCso />}
      {activeTab === "complexa" && <TabComplexa />}
      {activeTab === "cardsall" && <TabCardsAll />}
      {activeTab === "slackhistory" && <TabSlackHistory />}
      {activeTab === "cardsgerais" && <TabCardsGerais />}
        </>
      ) : (
        <SectionTrocaCodigo />
      )}
    </div>
  );
}

// =====================
// SECTION: TROCA DE CÓDIGO
// =====================

type FaseTrocaTab = "novo" | "em_andamento" | "aguardando" | "concluido" | "arquivado";

function SectionTrocaCodigo() {
  const [activeTabTroca, setActiveTabTroca] = useState<FaseTrocaTab>("em_andamento");
  const [cardsByPhase, setCardsByPhase] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [phases, setPhases] = useState<any[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [searchGlobal, setSearchGlobal] = useState("");
  const [searchPorFase, setSearchPorFase] = useState("");

  const loadAllData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/list-troca-codigo");
      const data = await res.json();
      if (data.success) {
        setPhases(data.phases);
        setCardsByPhase(data.cardsByPhase);
        setDataLoaded(true);
      } else {
        console.error("Erro da API:", data.error);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados automaticamente ao montar
  useEffect(() => {
    if (!dataLoaded) {
      loadAllData();
    }
  }, [dataLoaded]);

  // status enum (Supabase) → nome da aba
  const phaseMapping: Record<FaseTrocaTab, string> = {
    novo: "Novo",
    em_andamento: "Em Andamento",
    aguardando: "Aguardando",
    concluido: "Concluído",
    arquivado: "Arquivado",
  };

  // Filtragem por busca: aplica nas duas (global + por fase)
  const matchSearch = (card: any, q: string): boolean => {
    if (!q.trim()) return true;
    const needle = q.trim().toUpperCase();
    const fields = card.fields || [];
    const codigos = [
      card.title || "",
      ...fields.map((f: any) => f?.value || ""),
      card.descricao || "",
    ]
      .join("|")
      .toUpperCase();
    return codigos.includes(needle);
  };

  // Se a busca global tem texto, ignora a aba e mostra todos os cards de todas as fases
  // que casam. Senão, mostra apenas os da aba ativa filtrados pelo searchPorFase.
  const isGlobalSearching = searchGlobal.trim().length > 0;
  const currentPhaseName = phaseMapping[activeTabTroca];
  const currentCards: any[] = isGlobalSearching
    ? Object.values(cardsByPhase).flat().filter((c: any) => matchSearch(c, searchGlobal))
    : (cardsByPhase[currentPhaseName] || []).filter((c: any) => matchSearch(c, searchPorFase));

  // Helper para extrair valor de campo
  const getFieldValue = (fields: any[], fieldName: string): string => {
    const field = fields?.find((f: any) => f.name === fieldName);
    return field?.value || "";
  };

  const tabs: { id: FaseTrocaTab; label: string; help: string }[] = [
    { id: "novo", label: "Novo", help: "Cards na fase Novo" },
    { id: "em_andamento", label: "Em Andamento", help: "Cards em andamento" },
    { id: "aguardando", label: "Aguardando", help: "Cards aguardando" },
    { id: "concluido", label: "Concluído", help: "Cards concluídos" },
    { id: "arquivado", label: "Arquivado", help: "Cards arquivados" },
  ];

  return (
    <div>
      {/* Header da seção */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Troca de Código</h2>
          <p className="text-gray-500 text-xs mt-1">Automação troca de código — Seazone</p>
        </div>
        <button
          onClick={loadAllData}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Carregando..." : "Carregar Dados"}
        </button>
      </div>

      {/* Busca global — pesquisa em TODAS as fases */}
      <div className="mb-3">
        <input
          type="text"
          value={searchGlobal}
          onChange={(e) => setSearchGlobal(e.target.value)}
          placeholder="Busca geral (todas as fases): código, título, descrição..."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {isGlobalSearching && (
          <p className="text-xs text-blue-600 mt-1">
            Mostrando {currentCards.length} resultado(s) em todas as fases.
            <button onClick={() => setSearchGlobal("")} className="ml-2 underline">Limpar</button>
          </p>
        )}
      </div>

      {/* Tabs das fases - lado a lado (somem quando busca global está ativa) */}
      {!isGlobalSearching && (
      <div className="mb-3 bg-gray-100 p-1 rounded-lg">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const count = cardsByPhase[phaseMapping[tab.id]]?.length || 0;
            return (
              <WithHelp key={tab.id} help={tab.help} className="relative flex-1">
                <button
                  onClick={() => setActiveTabTroca(tab.id)}
                  className={`w-full py-2.5 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    activeTabTroca === tab.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs ${activeTabTroca === tab.id ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600"}`}>
                      {count}
                    </span>
                  )}
                </button>
              </WithHelp>
            );
          })}
        </div>
      </div>
      )}

      {/* Busca por fase (só aparece quando não está em busca global) */}
      {!isGlobalSearching && (
        <div className="mb-3">
          <input
            type="text"
            value={searchPorFase}
            onChange={(e) => setSearchPorFase(e.target.value)}
            placeholder={`Buscar dentro de "${currentPhaseName}"...`}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Cards da fase selecionada */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Carregando cards...</div>
      ) : currentCards.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>Nenhum card nesta fase.</p>
          <p className="text-xs mt-2">Clique em "Carregar Dados" para buscar as informações.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {currentCards.map((card: any) => (
            <CardTrocaCode
              key={card.id}
              card={card}
              phaseName={isGlobalSearching ? phaseMapping[card.status as FaseTrocaTab] || "" : currentPhaseName}
              getFieldValue={getFieldValue}
              onReload={loadAllData}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =====================
// CARD TROCA DE CÓDIGO (expandível)
// =====================

interface StatusCampo {
  valor: "sim" | "nao" | "pendente";
  data?: string;
  mensagem?: string;
}

interface CardTrocaCodeProps {
  card: any;
  phaseName: string;
  getFieldValue: (fields: any[], name: string) => string;
  onReload?: () => void;
}

interface PipefyPreviewMatch {
  kind: "card" | "record";
  containerId: string;
  containerLabel: string;
  itemId: string;
  title: string;
  phaseId: string | null;
  phaseName: string | null;
  url: string | null;
  matchType: "exact" | "partial";
}

interface PipefyStaysCheck {
  listingId: string;
  internalName: string;
  internalNameStatus: "antigo" | "novo" | "drift";
  mstitleAntigoCount: number;
  mstitleNovoCount: number;
  mstitleTotal: number;
  resumo: string;
}

interface PipefyPreviewData {
  resumo: string;
  exatosAntigo: PipefyPreviewMatch[];
  parciaisAntigo: PipefyPreviewMatch[];
  exatosNovo: PipefyPreviewMatch[];
  staysCheck?: PipefyStaysCheck | null;
  staysCheckErro?: string | null;
}

interface PipefyTrocaResult {
  kind: "card" | "record" | "stays";
  itemId: string;
  containerLabel: string;
  phaseName: string | null;
  tituloAntigo: string;
  status: "ok" | "erro";
  erro?: string;
  fieldImovel?: "ok" | "skip" | "erro";
  fieldImovelErro?: string;
  comentario?: "ok" | "skip" | "erro";
  comentarioErro?: string;
  staysTitulosCount?: number;
}

interface PipefyTrocaData {
  total: number;
  sucessos: number;
  erros: number;
  resultados: PipefyTrocaResult[];
  mensagem: string;
}

// Sequência das fases pra avançar/retornar
const FASE_SEQUENCE: ReadonlyArray<{ status: string; label: string }> = [
  { status: "novo", label: "Novo" },
  { status: "em_andamento", label: "Em Andamento" },
  { status: "aguardando", label: "Aguardando" },
  { status: "concluido", label: "Concluído" },
  { status: "arquivado", label: "Arquivado" },
];

function CardTrocaCode({ card, phaseName, getFieldValue, onReload }: CardTrocaCodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [pipefyPreview, setPipefyPreview] = useState<PipefyPreviewData | null>(null);
  const [pipefyTroca, setPipefyTroca] = useState<PipefyTrocaData | null>(null);

  // Flags vindos do backend suporte-ops (campos checkbox preenchidos pelo time)
  const flags = card.statusFlags || {};
  const flagToStatus = (b: any): "sim" | "pendente" => (b ? "sim" : "pendente");
  const [status, setStatus] = useState<Record<string, StatusCampo>>({
    planilha: { valor: flagToStatus(flags.alteradoBaseCodigo) },
    precoMinimo: { valor: "pendente" },
    sapron: { valor: flagToStatus(flags.alteradoSapron) },
    pipefy: { valor: flagToStatus(flags.alteradoPipefy) },
    stays: { valor: flagToStatus(flags.alteradoStays) },
    moverCard: { valor: "pendente" },
    airbnb: { valor: flagToStatus(flags.alteradoOtas) },
    expedia: { valor: flagToStatus(flags.alteradoOtas) },
    pipedrive: { valor: flagToStatus(flags.alteradoPipedrive) },
    csProp: { valor: flagToStatus(flags.alteradoPipefyCsProp) },
  });

  const fields = card.fields || [];
  const codigoAntigo = getFieldValue(fields, "Código Antigo") || card.title;
  const codigoNovo =
    getFieldValue(fields, "Novo Código") || getFieldValue(fields, "Código Novo") || "";
  const solicitante =
    getFieldValue(fields, "Quem Solicitou") || getFieldValue(fields, "Solicitante") || "";
  const motivo = getFieldValue(fields, "Motivo da troca") || "";
  const statusImovel = getFieldValue(fields, "Status do Imóvel") || "";
  const lastComment = card.lastComment;

  const getStatusBadge = (campo: string) => {
    const s = status[campo];
    if (s.valor === "sim") {
      return <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Sim</span>;
    } else if (s.valor === "nao") {
      return <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Não</span>;
    } else {
      return <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">Pendente</span>;
    }
  };

  // Validar na planilha
  const validarPlanilha = async () => {
    setLoadingAction("planilha");
    try {
      const res = await fetch(
        `/api/validar-planilha-troca?codigoAntigo=${encodeURIComponent(codigoAntigo)}&codigoNovo=${encodeURIComponent(codigoNovo)}`
      );
      const data = await res.json();
      if (data.success) {
        setStatus((prev) => ({
          ...prev,
          planilha: {
            valor: data.resultados.codigoNovo.encontrado ? "sim" : "nao",
            mensagem: data.mensagem,
          },
        }));
      } else {
        setStatus((prev) => ({
          ...prev,
          planilha: { valor: "nao", mensagem: data.error },
        }));
      }
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        planilha: { valor: "nao", mensagem: "Erro de conexão" },
      }));
    } finally {
      setLoadingAction(null);
    }
  };

  // Validar na planilha de Preço Mínimo
  const validarPrecoMinimo = async () => {
    setLoadingAction("precoMinimo");
    try {
      const res = await fetch(
        `/api/validar-preco-minimo?codigoAntigo=${encodeURIComponent(codigoAntigo)}&codigoNovo=${encodeURIComponent(codigoNovo)}`
      );
      const data = await res.json();
      if (data.success) {
        const algumEncontrado =
          data.resultados.codigoAntigo.encontrado ||
          data.resultados.codigoNovo.encontrado;
        setStatus((prev) => ({
          ...prev,
          precoMinimo: {
            valor: algumEncontrado ? "sim" : "nao",
            mensagem: data.mensagem,
          },
        }));
      } else {
        setStatus((prev) => ({
          ...prev,
          precoMinimo: { valor: "nao", mensagem: data.error },
        }));
      }
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        precoMinimo: { valor: "nao", mensagem: "Erro de conexão" },
      }));
    } finally {
      setLoadingAction(null);
    }
  };

  // Pré-visualizar troca no Pipefy: lista cards com o código antigo nos pipes monitorados
  const previewTrocaPipefy = async () => {
    setLoadingAction("pipefy");
    try {
      const res = await fetch(
        `/api/pipefy-preview-troca?codigoAntigo=${encodeURIComponent(codigoAntigo)}&codigoNovo=${encodeURIComponent(codigoNovo)}`
      );
      const data = await res.json();
      if (data.success) {
        setPipefyPreview({
          resumo: data.resumo,
          exatosAntigo: data.exatosAntigo,
          parciaisAntigo: data.parciaisAntigo,
          exatosNovo: data.exatosNovo,
          staysCheck: data.staysCheck,
          staysCheckErro: data.staysCheckErro,
        });
        setStatus((prev) => ({
          ...prev,
          pipefy: {
            // se já existe card com o código novo, sinalizar como "sim" (troca já feita / duplicidade)
            valor: data.exatosNovo.length > 0 && data.exatosAntigo.length === 0 ? "sim" : "pendente",
            mensagem: data.resumo,
          },
        }));
      } else {
        setStatus((prev) => ({
          ...prev,
          pipefy: { valor: "nao", mensagem: data.error },
        }));
      }
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        pipefy: { valor: "nao", mensagem: "Erro de conexão" },
      }));
    } finally {
      setLoadingAction(null);
    }
  };

  // Aplicar troca de títulos no Pipefy (usa o preview pra confirmação)
  const aplicarTrocaPipefy = async () => {
    if (!pipefyPreview || pipefyPreview.exatosAntigo.length === 0) return;
    if (!codigoNovo) return;

    const total = pipefyPreview.exatosAntigo.length;
    const pipes = Array.from(
      new Set(pipefyPreview.exatosAntigo.map((m) => m.containerLabel))
    ).join(", ");
    const ok = window.confirm(
      `Renomear ${total} card(s) de "${codigoAntigo}" para "${codigoNovo}" em ${pipes}?\n\nEsta ação altera os títulos no Pipefy e não pode ser desfeita.`
    );
    if (!ok) return;

    setLoadingAction("trocaPipefy");
    try {
      const res = await fetch("/api/pipefy-trocar-titulos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigoAntigo, codigoNovo }),
      });
      const data = await res.json();
      if (data.success) {
        setPipefyTroca({
          total: data.total,
          sucessos: data.sucessos,
          erros: data.erros,
          resultados: data.resultados,
          mensagem: data.mensagem,
        });
        setStatus((prev) => ({
          ...prev,
          pipefy: {
            valor: data.erros === 0 && data.sucessos > 0 ? "sim" : "nao",
            mensagem: data.mensagem,
          },
        }));
        // Limpar preview pra forçar nova consulta caso o user queira reverificar
        setPipefyPreview(null);
      } else {
        setStatus((prev) => ({
          ...prev,
          pipefy: { valor: "nao", mensagem: data.error || "Erro ao trocar" },
        }));
      }
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        pipefy: { valor: "nao", mensagem: "Erro de conexão" },
      }));
    } finally {
      setLoadingAction(null);
    }
  };

  // Verificar Sapron
  const verificarSapron = async () => {
    setLoadingAction("sapron");
    try {
      const res = await fetch(
        `/api/validar-sapron-troca?codigoAntigo=${encodeURIComponent(codigoAntigo)}&codigoNovo=${encodeURIComponent(codigoNovo)}`
      );
      const data = await res.json();
      if (data.success) {
        // "completo" = troca já feita, "nao_iniciado" = ainda não
        setStatus((prev) => ({
          ...prev,
          sapron: {
            valor: data.statusTroca === "completo" ? "sim" : "nao",
            mensagem: data.mensagem,
          },
        }));
      } else {
        setStatus((prev) => ({
          ...prev,
          sapron: { valor: "nao", mensagem: data.error },
        }));
      }
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        sapron: { valor: "nao", mensagem: "Erro de conexão" },
      }));
    } finally {
      setLoadingAction(null);
    }
  };

  // Mover card no suporte-ops: 2 etapas — preview (dryRun) → confirmar (PATCH)
  const [moverPreview, setMoverPreview] = useState<{
    statusImovel: string;
    camposAplicados: Record<string, any>;
    camposAtuais: Record<string, any>;
    statusAtual: string;
    novoStatus: string;
    templateBotaoEnviar?: string | null;
  } | null>(null);

  const flagsAtuais = () => ({
    planilha: status.planilha.valor === "sim",
    sapron: status.sapron.valor === "sim",
    pipefy: status.pipefy.valor === "sim",
    stays: status.stays.valor === "sim",
    precoMinimo:
      status.precoMinimo.valor === "sim"
        ? "sim"
        : status.precoMinimo.valor === "nao"
          ? "nao"
          : null,
  });

  // Avançar / retornar fase (PATCH no status do card no Supabase)
  const moverFase = async (novoStatus: string) => {
    if (!card?.id) return;
    setLoadingAction(`fase:${novoStatus}`);
    try {
      const res = await fetch("/api/suporte-mover-fase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardSuporteId: card.id, novoStatus }),
      });
      const data = await res.json();
      if (data.success) {
        if (onReload) onReload();
      } else {
        alert(`Erro ao mover fase: ${data.error || "desconhecido"}`);
      }
    } catch (err: any) {
      alert(`Erro ao mover fase: ${err?.message || err}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const indiceFaseAtual = FASE_SEQUENCE.findIndex((f) => f.status === card.status);
  const faseAnterior = indiceFaseAtual > 0 ? FASE_SEQUENCE[indiceFaseAtual - 1] : null;
  const faseProxima = indiceFaseAtual >= 0 && indiceFaseAtual < FASE_SEQUENCE.length - 1
    ? FASE_SEQUENCE[indiceFaseAtual + 1]
    : null;

  // Etapa 1: chama dryRun e mostra bloco preview inline
  const previewMover = async () => {
    if (!card?.id || !codigoAntigo || !codigoNovo) return;
    setLoadingAction("moverCardPreview");
    try {
      const res = await fetch("/api/suporte-mover-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardSuporteId: card.id,
          codigoAntigo,
          codigoNovo,
          flags: flagsAtuais(),
          dryRun: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMoverPreview({
          statusImovel: data.statusImovel || "",
          camposAplicados: data.camposAplicados || {},
          camposAtuais: data.camposAtuais || {},
          statusAtual: data.statusAtual || "",
          novoStatus: data.novoStatus || "aguardando",
          templateBotaoEnviar: data.templateBotaoEnviar || null,
        });
        setStatus((prev) => ({ ...prev, moverCard: { valor: "pendente" } }));
      } else {
        setStatus((prev) => ({
          ...prev,
          moverCard: { valor: "nao", mensagem: data.error || "Erro no preview" },
        }));
      }
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        moverCard: { valor: "nao", mensagem: "Erro de conexão" },
      }));
    } finally {
      setLoadingAction(null);
    }
  };

  // Etapa 2: confirma e aplica PATCH
  const aplicarMover = async () => {
    if (!card?.id || !codigoAntigo || !codigoNovo) return;
    setLoadingAction("moverCard");
    try {
      const res = await fetch("/api/suporte-mover-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardSuporteId: card.id,
          codigoAntigo,
          codigoNovo,
          flags: flagsAtuais(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus((prev) => ({
          ...prev,
          moverCard: { valor: "sim", mensagem: data.mensagem },
        }));
        setMoverPreview(null);
      } else {
        setStatus((prev) => ({
          ...prev,
          moverCard: { valor: "nao", mensagem: data.error || "Erro ao mover card" },
        }));
      }
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        moverCard: { valor: "nao", mensagem: "Erro de conexão" },
      }));
    } finally {
      setLoadingAction(null);
    }
  };

  // Trocar na Stays — 2 etapas (preview → confirmar)
  const [staysPreview, setStaysPreview] = useState<{
    staysId: string;
    internalNameAntigo: string;
    internalNameNovo: string;
    titulosAtualizados: Record<string, { antigo: string; novo: string }>;
    precisaPatch: boolean;
    mensagem: string;
  } | null>(null);

  const previewStays = async () => {
    if (!codigoAntigo || !codigoNovo) return;
    setLoadingAction("staysPreview");
    try {
      const res = await fetch("/api/stays-trocar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigoAntigo, codigoNovo, dryRun: true }),
      });
      const data = await res.json();
      if (data.success) {
        // Se nada precisa mudar, a Stays já está com o código novo → marca
        // "Sim" no tracker e NÃO abre o bloco preview (não tem o que confirmar).
        if (!data.precisaPatch) {
          setStatus((prev) => ({
            ...prev,
            stays: { valor: "sim", mensagem: data.mensagem },
          }));
          setStaysPreview(null);
        } else {
          setStaysPreview({
            staysId: data.staysId,
            internalNameAntigo: data.internalNameAntigo || "",
            internalNameNovo: data.internalNameNovo || "",
            titulosAtualizados: data.titulosAtualizados || {},
            precisaPatch: true,
            mensagem: data.mensagem,
          });
          setStatus((prev) => ({ ...prev, stays: { valor: "pendente" } }));
        }
      } else {
        setStatus((prev) => ({
          ...prev,
          stays: { valor: "nao", mensagem: data.error || "Erro no preview" },
        }));
      }
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        stays: { valor: "nao", mensagem: "Erro de conexão" },
      }));
    } finally {
      setLoadingAction(null);
    }
  };

  const aplicarStays = async () => {
    if (!codigoAntigo || !codigoNovo) return;
    setLoadingAction("stays");
    try {
      const res = await fetch("/api/stays-trocar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigoAntigo, codigoNovo }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus((prev) => ({
          ...prev,
          stays: {
            valor: data.patchEnviado ? "sim" : "nao",
            mensagem: data.mensagem,
          },
        }));
        setStaysPreview(null);
      } else {
        setStatus((prev) => ({
          ...prev,
          stays: { valor: "nao", mensagem: data.error || "Erro ao atualizar Stays" },
        }));
      }
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        stays: { valor: "nao", mensagem: "Erro de conexão" },
      }));
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      {/* Header do card */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div>
            <p className="font-semibold text-gray-900">{card.title}</p>
            <div className="flex items-center gap-4 mt-1 flex-wrap">
              <span className="text-xs text-gray-500">
                <span className="font-medium">De:</span> {codigoAntigo} → <span className="font-medium">Para:</span> {codigoNovo}
              </span>
              {solicitante && (
                <span className="text-xs text-gray-400">
                  Por: {solicitante}
                </span>
              )}
              {card.urgencia && (
                <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                  {card.urgencia}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastComment && phaseName === "Fazendo" && (
            <div className="hidden md:block max-w-xs">
              <p className="text-xs text-gray-500 truncate">{lastComment.text}</p>
            </div>
          )}
          {card.url && (
            <a
              href={card.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-blue-600 hover:underline whitespace-nowrap"
            >
              suporte-ops ↗
            </a>
          )}
          {/* Botões de avançar/retornar fase — sempre visíveis no header */}
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {faseAnterior && (
              <button
                onClick={() => moverFase(faseAnterior.status)}
                disabled={loadingAction === `fase:${faseAnterior.status}`}
                className="text-[10px] px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50 whitespace-nowrap"
                title={`Retornar para "${faseAnterior.label}"`}
              >
                ← {faseAnterior.label}
              </button>
            )}
            {faseProxima && (
              <button
                onClick={() => moverFase(faseProxima.status)}
                disabled={loadingAction === `fase:${faseProxima.status}`}
                className="text-[10px] px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                title={`Avançar para "${faseProxima.label}"`}
              >
                {faseProxima.label} →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expandido */}
      {expanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          {/* Info básica */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 text-sm">
            <div>
              <span className="text-gray-500">Código Antigo:</span>
              <span className="ml-2 font-medium">{codigoAntigo}</span>
            </div>
            <div>
              <span className="text-gray-500">Código Novo:</span>
              <span className="ml-2 font-medium">{codigoNovo}</span>
            </div>
            <div>
              <span className="text-gray-500">Status do Imóvel:</span>
              <span
                className={`ml-2 font-medium ${
                  statusImovel === "Ativo"
                    ? "text-green-700"
                    : statusImovel === "Implantação"
                    ? "text-amber-700"
                    : "text-gray-400"
                }`}
              >
                {statusImovel || "—"}
              </span>
            </div>
          </div>

          {/* Status + Ações + previews — escondidos na fase Aguardando */}
          {card.status !== "aguardando" && (<>
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Status das Alterações</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div className="flex flex-col bg-white px-3 py-2 rounded border">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Planilha</span>
                  {getStatusBadge("planilha")}
                </div>
                {status.planilha.mensagem && (
                  <span className="text-xs text-gray-500 mt-1">{status.planilha.mensagem}</span>
                )}
              </div>
              <div className="flex flex-col bg-white px-3 py-2 rounded border">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Preço Mínimo</span>
                  {getStatusBadge("precoMinimo")}
                </div>
                {status.precoMinimo.mensagem && (
                  <span className="text-xs text-gray-500 mt-1">{status.precoMinimo.mensagem}</span>
                )}
              </div>
              <div className="flex items-center justify-between bg-white px-3 py-2 rounded border">
                <span className="text-xs text-gray-600">Pipefy</span>
                {getStatusBadge("pipefy")}
              </div>
              <div className="flex flex-col bg-white px-3 py-2 rounded border">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Sapron</span>
                  {getStatusBadge("sapron")}
                </div>
                {status.sapron.mensagem && (
                  <span className="text-xs text-gray-500 mt-1">{status.sapron.mensagem}</span>
                )}
              </div>
              <div className="flex flex-col bg-white px-3 py-2 rounded border">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Stays</span>
                  {getStatusBadge("stays")}
                </div>
                {status.stays.mensagem && (
                  <span className="text-xs text-gray-500 mt-1">{status.stays.mensagem}</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
              <div className="flex items-center justify-between bg-white px-3 py-2 rounded border">
                <span className="text-xs text-gray-600">Airbnb</span>
                {getStatusBadge("airbnb")}
              </div>
              <div className="flex items-center justify-between bg-white px-3 py-2 rounded border">
                <span className="text-xs text-gray-600">Expedia</span>
                {getStatusBadge("expedia")}
              </div>
              <div className="flex items-center justify-between bg-white px-3 py-2 rounded border">
                <span className="text-xs text-gray-600">Pipedrive</span>
                {getStatusBadge("pipedrive")}
              </div>
              <div className="flex items-center justify-between bg-white px-3 py-2 rounded border">
                <span className="text-xs text-gray-600">CS PROP</span>
                {getStatusBadge("csProp")}
              </div>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Ações</h4>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={validarPlanilha}
                disabled={loadingAction === "planilha" || !codigoNovo}
                className="px-4 py-2 bg-yellow-600 text-white text-sm rounded-md hover:bg-yellow-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loadingAction === "planilha" ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Validando...
                  </>
                ) : (
                  "Validar na Planilha"
                )}
              </button>
              <button
                onClick={validarPrecoMinimo}
                disabled={loadingAction === "precoMinimo" || (!codigoAntigo && !codigoNovo)}
                className="px-4 py-2 bg-amber-600 text-white text-sm rounded-md hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loadingAction === "precoMinimo" ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Verificando...
                  </>
                ) : (
                  "Verificar Preço Mínimo"
                )}
              </button>
              <button
                onClick={previewTrocaPipefy}
                disabled={loadingAction === "pipefy" || !codigoAntigo}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loadingAction === "pipefy" ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Buscando...
                  </>
                ) : (
                  "Pré-visualizar Pipefy"
                )}
              </button>
              <button
                onClick={verificarSapron}
                disabled={loadingAction === "sapron" || !codigoNovo}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loadingAction === "sapron" ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Verificando...
                  </>
                ) : (
                  "Verificar Sapron"
                )}
              </button>
              <button
                onClick={previewStays}
                disabled={loadingAction === "staysPreview" || loadingAction === "stays" || !codigoAntigo || !codigoNovo}
                className="px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loadingAction === "staysPreview" ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Preview...
                  </>
                ) : status.stays.valor === "sim" ? (
                  "Stays atualizada ✓"
                ) : (
                  "Trocar na Stays"
                )}
              </button>
              <button
                onClick={previewMover}
                disabled={loadingAction === "moverCardPreview" || loadingAction === "moverCard" || !codigoAntigo || !codigoNovo}
                className="px-4 py-2 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                title="Mostra preview do que vai preencher no card e move pra Aguardando"
              >
                {loadingAction === "moverCardPreview" ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Preview...
                  </>
                ) : status.moverCard.valor === "sim" ? (
                  "Movido ✓"
                ) : (
                  "Mover card"
                )}
              </button>
            </div>

            {/* Preview inline: Trocar na Stays — internalName + sufixo dos _mstitle */}
            {staysPreview && (
              <div className="mt-3 p-4 bg-white border border-gray-200 rounded-md">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-800">
                    Preview — Trocar na Stays (listing {staysPreview.staysId})
                  </h4>
                  <button
                    onClick={() => setStaysPreview(null)}
                    className="text-gray-400 hover:text-gray-700 text-base leading-none"
                    aria-label="Cancelar preview"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-gray-600 mb-3">{staysPreview.mensagem}</p>

                {staysPreview.precisaPatch ? (
                  <ul className="space-y-1.5 text-sm mb-4">
                    {staysPreview.internalNameAntigo !== staysPreview.internalNameNovo && (
                      <li className="flex items-baseline gap-2">
                        <span className="text-gray-600">internalName:</span>
                        <span className="text-gray-500 line-through">
                          {staysPreview.internalNameAntigo || "(vazio)"}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="text-purple-700 font-medium">
                          {staysPreview.internalNameNovo}
                        </span>
                      </li>
                    )}
                    {Object.entries(staysPreview.titulosAtualizados).map(([lang, t]) => (
                      <li key={lang} className="flex flex-col text-xs">
                        <span className="text-gray-600">_mstitle.{lang}:</span>
                        <span className="text-gray-500 line-through pl-3">{t.antigo}</span>
                        <span className="text-purple-700 pl-3">{t.novo}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-amber-700 mb-4">Nada a alterar.</p>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={aplicarStays}
                    disabled={loadingAction === "stays" || !staysPreview.precisaPatch}
                    className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {loadingAction === "stays" ? (
                      <>
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Aplicando...
                      </>
                    ) : (
                      "Confirmar e atualizar Stays"
                    )}
                  </button>
                  <button
                    onClick={() => setStaysPreview(null)}
                    className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs rounded hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Preview inline: o que vai ser preenchido no card */}
            {moverPreview && (
              <div className="mt-3 p-4 bg-white border border-gray-200 rounded-md">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-800">
                    Preview — Mover card pra Aguardando
                  </h4>
                  <button
                    onClick={() => setMoverPreview(null)}
                    className="text-gray-400 hover:text-gray-700 text-base leading-none"
                    aria-label="Cancelar preview"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-xs text-gray-600 mb-3">
                  Vou preencher estes campos no card do suporte-ops e depois mover pra <strong>"Aguardando"</strong>:
                </p>

                <ul className="space-y-1.5 text-sm mb-4">
                  {Object.entries(moverPreview.camposAplicados).map(([k, novo]) => {
                    let valorFormatado: React.ReactNode;
                    if (novo === true) {
                      valorFormatado = <span className="text-green-700 font-medium">Marcado ✔️</span>;
                    } else if (novo === false) {
                      valorFormatado = <span className="text-gray-500">desmarcado ❌</span>;
                    } else if (novo === undefined || novo === null || novo === "") {
                      valorFormatado = <span className="text-gray-400 italic">(em branco)</span>;
                    } else {
                      valorFormatado = <span className="text-gray-900 font-medium">{String(novo)}</span>;
                    }
                    return (
                      <li key={k} className="flex items-baseline gap-2">
                        <span className="text-gray-600">{k}:</span>
                        {valorFormatado}
                      </li>
                    );
                  })}
                  <li className="flex items-baseline gap-2 pt-2 border-t border-gray-100">
                    <span className="text-gray-600">Após salvar:</span>
                    <span className="text-orange-700 font-medium">
                      mover de "{moverPreview.statusAtual}" → "{moverPreview.novoStatus}"
                    </span>
                  </li>
                  <li className="flex items-baseline gap-2">
                    <span className="text-gray-600">Botão "enviar" (template Slack):</span>
                    {moverPreview.templateBotaoEnviar ? (
                      <span className="text-green-700 font-medium">
                        ✓ vai disparar (insere comentário + notify-slack)
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">
                        sem template — não disparado
                      </span>
                    )}
                  </li>
                </ul>
                {moverPreview.templateBotaoEnviar && (
                  <details className="mb-3 -mt-1">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                      Ver mensagem que vai pro Slack
                    </summary>
                    <pre className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs whitespace-pre-wrap text-gray-700">
                      {moverPreview.templateBotaoEnviar}
                    </pre>
                  </details>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={aplicarMover}
                    disabled={loadingAction === "moverCard"}
                    className="px-3 py-1.5 bg-orange-600 text-white text-xs rounded hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {loadingAction === "moverCard" ? (
                      <>
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Aplicando...
                      </>
                    ) : (
                      "Confirmar e mover pra Aguardando"
                    )}
                  </button>
                  <button
                    onClick={() => setMoverPreview(null)}
                    className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs rounded hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {status.moverCard.mensagem && (
              <p
                className={`text-xs mt-2 ${
                  status.moverCard.valor === "sim" ? "text-green-700" : "text-red-600"
                }`}
              >
                {status.moverCard.mensagem}
              </p>
            )}
          </div>
          </>)}

          {/* Bloco "Campos desta fase — Aguardando" — só aparece nessa fase */}
          {card.status === "aguardando" && (
            <>
              <AguardandoBlock
                cardId={card.id}
                codigoAntigo={codigoAntigo}
                codigoNovo={codigoNovo}
                statusFlags={card.statusFlags || {}}
                onReload={onReload}
              />
              <SlackValidacaoBlock
                slackChannel={card.slack_channel || ""}
                slackTs={card.slack_ts || ""}
                codigoAntigo={codigoAntigo}
              />
            </>
          )}

          {/* Resultado do Preview Pipefy */}
          {pipefyPreview && (
            <div className="mb-4 p-3 bg-white border border-gray-200 rounded-md">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">Preview Pipefy</h4>
                <button
                  onClick={() => setPipefyPreview(null)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                  aria-label="Fechar preview"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-gray-600 mb-3">{pipefyPreview.resumo}</p>

              {pipefyPreview.exatosAntigo.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-medium text-gray-700 mb-1">
                    Cards com código antigo (match exato) — {pipefyPreview.exatosAntigo.length}:
                  </div>
                  <ul className="space-y-1">
                    {pipefyPreview.exatosAntigo.map((m) => (
                      <li key={`a-${m.itemId}`} className="text-xs flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                          {m.containerLabel}
                        </span>
                        <span className="text-gray-600">{m.title}</span>
                        {m.phaseName && (
                          <span className="text-gray-400">· {m.phaseName}</span>
                        )}
                        {m.url && (
                          <a
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            abrir
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {pipefyPreview.exatosNovo.length > 0 && (
                <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded">
                  <div className="text-xs font-medium text-amber-800 mb-1">
                    ⚠ Cards já existentes com o código novo — {pipefyPreview.exatosNovo.length}:
                  </div>
                  <ul className="space-y-1">
                    {pipefyPreview.exatosNovo.map((m) => (
                      <li key={`n-${m.itemId}`} className="text-xs flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">
                          {m.containerLabel}
                        </span>
                        <span className="text-gray-700">{m.title}</span>
                        {m.phaseName && (
                          <span className="text-gray-500">· {m.phaseName}</span>
                        )}
                        {m.url && (
                          <a
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-700 hover:underline"
                          >
                            abrir
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(pipefyPreview.staysCheck || pipefyPreview.staysCheckErro) && (
                <div className={`mb-3 p-2 rounded border ${
                  pipefyPreview.staysCheck?.internalNameStatus === "antigo"
                    ? "bg-blue-50 border-blue-200"
                    : pipefyPreview.staysCheck?.internalNameStatus === "novo" && pipefyPreview.staysCheck.mstitleAntigoCount === 0
                    ? "bg-green-50 border-green-200"
                    : pipefyPreview.staysCheck?.internalNameStatus === "drift"
                    ? "bg-amber-50 border-amber-200"
                    : "bg-gray-50 border-gray-200"
                }`}>
                  <div className="text-xs font-medium text-gray-700 mb-1">
                    Stays — listing {pipefyPreview.staysCheck?.listingId || ""}
                  </div>
                  {pipefyPreview.staysCheckErro ? (
                    <p className="text-xs text-amber-700">Erro ao consultar: {pipefyPreview.staysCheckErro}</p>
                  ) : pipefyPreview.staysCheck ? (
                    <>
                      <p className="text-xs text-gray-700">{pipefyPreview.staysCheck.resumo}</p>
                      <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                        <span>internalName: <code className="bg-white px-1 rounded">{pipefyPreview.staysCheck.internalName}</code></span>
                        <span>·</span>
                        <span>_mstitle: {pipefyPreview.staysCheck.mstitleAntigoCount} c/ antigo / {pipefyPreview.staysCheck.mstitleNovoCount} c/ novo / {pipefyPreview.staysCheck.mstitleTotal} total</span>
                      </div>
                    </>
                  ) : null}
                </div>
              )}

              {pipefyPreview.parciaisAntigo.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                    Matches parciais ({pipefyPreview.parciaisAntigo.length}) — não serão renomeados automaticamente
                  </summary>
                  <ul className="mt-2 space-y-1 pl-4">
                    {pipefyPreview.parciaisAntigo.map((m) => (
                      <li key={`p-${m.itemId}`} className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {m.containerLabel}
                        </span>
                        <span className="text-gray-500">{m.title}</span>
                        {m.url && (
                          <a
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            abrir
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {pipefyPreview.exatosAntigo.length === 0 && pipefyPreview.exatosNovo.length === 0 && (
                <p className="text-xs text-gray-500">Nenhum match exato. Verifique se o código antigo está correto.</p>
              )}

              {pipefyPreview.exatosAntigo.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-2 flex-wrap">
                  <button
                    onClick={aplicarTrocaPipefy}
                    disabled={loadingAction === "trocaPipefy" || !codigoNovo}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {loadingAction === "trocaPipefy" ? (
                      <>
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Renomeando...
                      </>
                    ) : (
                      `Aplicar troca em ${pipefyPreview.exatosAntigo.length} card(s)`
                    )}
                  </button>
                  <span className="text-xs text-gray-500">
                    Renomeia o título de "{codigoAntigo}" → "{codigoNovo}" nos cards listados acima.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Resultado da Troca aplicada */}
          {pipefyTroca && (
            <div className="mb-4 p-3 bg-white border border-gray-200 rounded-md">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">Resultado da troca</h4>
                <button
                  onClick={() => setPipefyTroca(null)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                  aria-label="Fechar resultado"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-gray-600 mb-2">{pipefyTroca.mensagem}</p>
              <div className="flex gap-2 mb-2 text-xs">
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">
                  ✓ {pipefyTroca.sucessos}
                </span>
                {pipefyTroca.erros > 0 && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded">
                    ✕ {pipefyTroca.erros}
                  </span>
                )}
              </div>
              {pipefyTroca.resultados.length > 0 && (
                <ul className="space-y-1">
                  {pipefyTroca.resultados.map((r) => (
                    <li key={`r-${r.itemId}`} className="text-xs flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded ${
                          r.status === "ok" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {r.status === "ok" ? "✓" : "✕"}
                      </span>
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                        {r.containerLabel}
                      </span>
                      <span className="text-gray-600">
                        {r.tituloAntigo}
                      </span>
                      {r.phaseName && (
                        <span className="text-gray-400">· {r.phaseName}</span>
                      )}
                      {r.fieldImovel === "ok" && (
                        <span className="text-green-600 text-[10px]" title="Campo Imóvel do form atualizado">
                          + form Imóvel ✓
                        </span>
                      )}
                      {r.fieldImovel === "erro" && (
                        <span className="text-amber-600 text-[10px]" title={r.fieldImovelErro || ""}>
                          form Imóvel ✕
                        </span>
                      )}
                      {r.comentario === "ok" && (
                        <span className="text-green-600 text-[10px]" title="Comentário de troca adicionado">
                          + comentário ✓
                        </span>
                      )}
                      {r.comentario === "erro" && (
                        <span className="text-amber-600 text-[10px]" title={r.comentarioErro || ""}>
                          comentário ✕
                        </span>
                      )}
                      {r.kind === "stays" && typeof r.staysTitulosCount === "number" && r.status === "ok" && (
                        <span className="text-green-600 text-[10px]" title="Idiomas do _mstitle atualizados">
                          + {r.staysTitulosCount} título(s) ✓
                        </span>
                      )}
                      {r.erro && (
                        <span className="text-red-500">— {r.erro}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Motivo */}
          {motivo && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <span className="text-xs text-yellow-700 font-medium">Motivo: </span>
              <span className="text-xs text-yellow-700">{motivo}</span>
            </div>
          )}

          {/* Último comentário */}
          {lastComment && (
            <div className="mt-4 p-3 bg-white border border-gray-200 rounded-md">
              <div className="text-xs text-gray-500 mb-1">Último comentário:</div>
              <p className="text-sm text-gray-700">{lastComment.text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Bloco "Campos desta fase — Aguardando":
// 3 checkboxes (Pipedrive, OTAs, Pipefy CS Prop) com Salvar; botao Enviar
// dispara o mesmo template Slack do botao da fase em_andamento (sem mover card).
function AguardandoBlock({
  cardId,
  codigoAntigo,
  codigoNovo,
  statusFlags,
  onReload,
}: {
  cardId: string;
  codigoAntigo: string;
  codigoNovo: string;
  statusFlags: any;
  onReload?: () => void;
}) {
  const [pipedrive, setPipedrive] = useState<boolean>(!!statusFlags.alteradoPipedrive);
  const [otas, setOtas] = useState<boolean>(!!statusFlags.alteradoOtas);
  const [csProp, setCsProp] = useState<boolean>(!!statusFlags.alteradoPipefyCsProp);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const dirty =
    pipedrive !== !!statusFlags.alteradoPipedrive ||
    otas !== !!statusFlags.alteradoOtas ||
    csProp !== !!statusFlags.alteradoPipefyCsProp;

  const salvar = async () => {
    setSalvando(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/suporte-aguardando-campos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardSuporteId: cardId,
          flags: {
            alteradoPipedrive: pipedrive,
            alteradoOtas: otas,
            alteradoPipefyCsProp: csProp,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ tipo: "ok", texto: "Salvo no suporte-ops." });
        if (onReload) onReload();
      } else {
        setFeedback({ tipo: "erro", texto: data.error || "Erro ao salvar" });
      }
    } catch (err: any) {
      setFeedback({ tipo: "erro", texto: err?.message || "Erro de conexão" });
    } finally {
      setSalvando(false);
    }
  };

  const enviar = async () => {
    setEnviando(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/suporte-enviar-troca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardSuporteId: cardId, codigoAntigo, codigoNovo }),
      });
      const data = await res.json();
      if (data.success) {
        const slackOk = data?.slack?.status === "ok";
        setFeedback({
          tipo: slackOk ? "ok" : "erro",
          texto: slackOk
            ? "Comentário enviado e Slack notificado."
            : `Comentário criado, mas Slack falhou: ${data?.slack?.erro || "erro"}`,
        });
        if (onReload) onReload();
      } else {
        setFeedback({ tipo: "erro", texto: data.error || "Erro ao enviar" });
      }
    } catch (err: any) {
      setFeedback({ tipo: "erro", texto: err?.message || "Erro de conexão" });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mb-4 p-4 bg-white border border-gray-200 rounded-md">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-800">Campos desta fase — Aguardando</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            Processo: Troca de Código de Imóvel · {codigoAntigo}
          </p>
        </div>
        <button
          type="button"
          disabled={salvando || !dirty}
          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={salvar}
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </div>
      <div className="space-y-2 mb-3">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={pipedrive}
            onChange={(e) => setPipedrive(e.target.checked)}
          />
          Alterado no Pipedrive
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={otas}
            onChange={(e) => setOtas(e.target.checked)}
          />
          Alterado nas OTAs?
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={csProp}
            onChange={(e) => setCsProp(e.target.checked)}
          />
          Alterado no Pipefy - CS Prop
        </label>
      </div>
      <button
        type="button"
        disabled={enviando}
        className="px-3 py-1.5 text-xs bg-gray-100 border border-gray-300 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={enviar}
      >
        {enviando ? "Enviando..." : "enviar"}
      </button>
      {feedback && (
        <p
          className={`text-xs mt-2 ${
            feedback.tipo === "ok" ? "text-green-700" : "text-red-600"
          }`}
        >
          {feedback.texto}
        </p>
      )}
    </div>
  );
}

// Validacao Slack: le `conversations.replies` da thread do card e mostra
// reactions na mensagem do botao "enviar" (template) + replies depois do
// status "Aguardando". Util pra ver quem ja viu/respondeu.
interface SlackUserSimple {
  id: string;
  name: string;
}
interface SlackReactionSimple {
  name: string;
  emoji: string;
  users: SlackUserSimple[];
}
interface SlackMsgSimple {
  ts: string;
  time: string;
  text: string;
  user: SlackUserSimple | null;
  reactions: SlackReactionSimple[];
  isTemplateEnviar: boolean;
  isStatusChange: boolean;
}
interface SlackThreadData {
  totalMessages: number;
  lastActivityTime: string | null;
  templateMessage: SlackMsgSimple | null;
  repliesAfterAguardando: SlackMsgSimple[];
}

function SlackValidacaoBlock({
  slackChannel,
  slackTs,
  codigoAntigo,
}: {
  slackChannel: string;
  slackTs: string;
  codigoAntigo: string;
}) {
  const [data, setData] = useState<SlackThreadData | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const fetchThread = async () => {
    if (!slackChannel || !slackTs) {
      setErro("Card sem slack_channel/slack_ts — não foi postado no Slack.");
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams({
        channel: slackChannel,
        ts: slackTs,
        codigoAntigo,
      });
      const res = await fetch(`/api/slack-thread-troca?${params}`);
      const d = await res.json();
      if (d.success) {
        setData(d);
      } else {
        setErro(d.error || "Erro ao buscar thread");
      }
    } catch (err: any) {
      setErro(err?.message || "Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slackChannel, slackTs]);

  return (
    <div className="mb-4 p-4 bg-white border border-gray-200 rounded-md">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-800">Validação Slack</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            Quem reagiu/respondeu na thread depois que entrou em Aguardando.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          className="px-3 py-1.5 text-xs bg-gray-100 border border-gray-300 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
          onClick={fetchThread}
        >
          {loading ? "Carregando..." : "↻ Atualizar"}
        </button>
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      {!erro && !data && !loading && (
        <p className="text-xs text-gray-500">Sem dados ainda.</p>
      )}

      {data && (
        <div className="space-y-3 text-sm">
          <div className="text-xs text-gray-500">
            Thread: {data.totalMessages} mensagens
            {data.lastActivityTime && ` · Última atividade ${data.lastActivityTime}`}
          </div>

          {data.templateMessage ? (
            <div className="p-2 bg-blue-50 border border-blue-100 rounded">
              <div className="text-xs font-medium text-blue-900">
                📌 Mensagem &quot;enviar&quot; ({data.templateMessage.time})
              </div>
              {data.templateMessage.reactions.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  {data.templateMessage.reactions.map((r) => (
                    <span
                      key={r.name}
                      className="px-1.5 py-0.5 bg-white border border-blue-200 rounded inline-flex items-center gap-1"
                      title={r.users.map((u) => u.name).join(", ")}
                    >
                      <span className="text-base leading-none">{r.emoji}</span>
                      <span className="text-gray-700">
                        {r.users.map((u) => u.name).join(", ")}
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mt-1 text-xs text-gray-500 italic">
                  Sem reactions ainda
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 p-2 rounded">
              Mensagem do botão &quot;enviar&quot; não encontrada na thread (texto pode ter
              mudado). Verifique direto no Slack.
            </div>
          )}

          <div>
            <div className="text-xs font-medium text-gray-700 mb-1">
              💬 Replies depois do &quot;Aguardando&quot;:{" "}
              {data.repliesAfterAguardando.length}
            </div>
            {data.repliesAfterAguardando.length === 0 ? (
              <p className="text-xs text-gray-500 italic">
                Nenhuma resposta na thread após entrar em Aguardando.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {data.repliesAfterAguardando.map((m) => (
                  <li
                    key={m.ts}
                    className="text-xs border-l-2 border-gray-200 pl-2"
                  >
                    <span className="font-medium text-gray-700">
                      {m.user?.name || "?"}
                    </span>
                    <span className="text-gray-400"> ({m.time})</span>
                    <div className="text-gray-700 whitespace-pre-wrap mt-0.5">
                      {m.text.length > 240 ? m.text.slice(0, 240) + "…" : m.text}
                    </div>
                    {m.reactions.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {m.reactions.map((r) => (
                          <span
                            key={r.name}
                            className="text-[10px] px-1 bg-gray-100 rounded"
                            title={r.users.map((u) => u.name).join(", ")}
                          >
                            {r.emoji} {r.users.length}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
