"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";

// =====================
// Tooltip expandivel ao passar o mouse
// =====================

export function WithHelp({
  help,
  children,
  className,
}: {
  help: string;
  children: ReactNode;
  className?: string;
}) {
  const [showBtn, setShowBtn] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showBelow, setShowBelow] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // "~" separa linhas, "|" separa secoes com linha divisoria
  const formatHelp = (text: string) => {
    const sections = text.split("|");
    return sections.map((section, si) => {
      const lines = section.trim().split("~");
      return (
        <span key={si}>
          {si > 0 && (
            <>
              <br />
              <hr className="border-gray-700 my-1.5" />
            </>
          )}
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
      onMouseEnter={() => {
        if (hideTimeout.current) clearTimeout(hideTimeout.current);
        setShowBtn(true);
        setExpanded(false);
      }}
      onMouseLeave={() => {
        hideTimeout.current = setTimeout(() => {
          setShowBtn(false);
          setExpanded(false);
        }, 400);
      }}
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
        <div
          className={`absolute left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[11px] px-4 py-3 rounded-lg shadow-lg z-[60] w-[28rem] leading-relaxed ${
            showBelow ? "top-full mt-2" : "-top-2 -translate-y-full"
          }`}
        >
          {formatHelp(help)}
          <div
            className={`absolute left-1/2 -translate-x-1/2 rotate-45 w-2 h-2 bg-gray-900 ${
              showBelow ? "top-0 -translate-y-1/2" : "bottom-0 translate-y-1/2"
            }`}
          />
        </div>
      )}
    </div>
  );
}

// =====================
// Select com pesquisa
// =====================

export function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
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
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
          if (!e.target.value) onChange("");
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder || "Selecione..."}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {value && !open && (
        <button
          onClick={() => {
            onChange("");
            setSearch("");
            setOpen(true);
          }}
          className="absolute right-2 top-8 text-gray-400 hover:text-gray-600 text-xs"
        >
          limpar
        </button>
      )}
      {open && filtered.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((o) => (
            <button
              key={o}
              onClick={() => {
                onChange(o);
                setSearch("");
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                value === o ? "bg-blue-100 font-medium" : ""
              }`}
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
// Helpers de label/codigo
// =====================

export function hasDecorLabel(labels: string[] | undefined | null): boolean {
  if (!labels || !Array.isArray(labels)) return false;
  return labels.some(
    (l) => typeof l === "string" && l.trim().toUpperCase() === "DECOR"
  );
}

export function isFase10(text: string | undefined | null): boolean {
  if (!text || typeof text !== "string") return false;
  return /\bfase\s*10\b/i.test(text);
}

export function labelClass(label: string): string {
  if (isFase10(label))
    return "text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded";
  return "text-[10px] bg-gray-200 px-1.5 py-0.5 rounded";
}

export function CopyableCode({
  code,
  className = "text-sm",
}: {
  code: string;
  className?: string;
}) {
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
      <span
        className={`ml-1.5 text-[10px] font-normal transition-opacity ${
          copied
            ? "text-green-600 opacity-100"
            : "text-gray-400 opacity-0 group-hover:opacity-100"
        }`}
      >
        {copied ? "copiado!" : "copiar"}
      </span>
    </span>
  );
}
