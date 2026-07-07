// ========================
// Responsável dinâmico (fixo até mudar)
// Guardado em dashboard_settings (Supabase Dashadequaocao) via RPC SECURITY DEFINER.
// Usado pelas rotas de Fase 3, Fase 4 e Revisão para setar/filtrar o responsável dos cards.
// ========================

import { pipefyQuery, PIPE_ID, WESLLEY_USER_ID } from "./pipefy";

const SUPABASE_URL =
  process.env.ADEQUA_SUPABASE_URL || "https://jbizxnauupdzmlmhqbjq.supabase.co";
const SUPABASE_ANON = process.env.ADEQUA_SUPABASE_ANON_KEY || "";

export interface Responsavel {
  id: string;
  name: string;
}

const FALLBACK: Responsavel = { id: WESLLEY_USER_ID, name: "Weslley Bertoldo" };

async function rpc(fn: string, body: Record<string, unknown>) {
  if (!SUPABASE_ANON) throw new Error("ADEQUA_SUPABASE_ANON_KEY não configurado");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`Supabase RPC ${fn}: ${res.status} ${txt.slice(0, 200)}`);
  return txt ? JSON.parse(txt) : null;
}

/**
 * Lê o responsável atual do banco. Em qualquer falha, cai no fallback (Weslley)
 * — nunca lança, pois as rotas de fase dependem disso e não podem quebrar.
 */
export async function getResponsavel(): Promise<Responsavel> {
  try {
    const data = await rpc("adequa_get_responsavel", {});
    const row = Array.isArray(data) ? data[0] : data;
    const id = row?.responsavel_id;
    const name = row?.responsavel_nome;
    if (id) return { id: String(id), name: name ? String(name) : id };
    return FALLBACK;
  } catch {
    return FALLBACK;
  }
}

/** Salva o responsável (fixo até mudar). Lança em erro para a rota devolver 500. */
export async function setResponsavel(id: string, name: string): Promise<void> {
  await rpc("adequa_set_responsavel", { p_id: id, p_nome: name });
}

/** Um assignee do card "é" o responsável selecionado? (por id ou por nome). */
export function isResponsavel(assignees: { id?: string; name?: string }[], resp: Responsavel): boolean {
  const nome = resp.name.toLowerCase();
  return (assignees || []).some(
    (a) => a.id === resp.id || (!!a.name && a.name.toLowerCase().includes(nome))
  );
}

/** Lista os membros do pipe (para o seletor de responsável). Ordenado por nome. */
export async function listPipeMembers(): Promise<Responsavel[]> {
  const result = await pipefyQuery(`{
    pipe(id: ${PIPE_ID}) {
      members { user { id name } }
    }
  }`);
  const members = result?.data?.pipe?.members || [];
  const seen = new Set<string>();
  const users: Responsavel[] = [];
  for (const m of members) {
    const u = m?.user;
    if (!u?.id || seen.has(u.id)) continue;
    seen.add(u.id);
    users.push({ id: String(u.id), name: u.name || String(u.id) });
  }
  users.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return users;
}
