import { pipefyQuery, sanitizeGraphQL } from "@/lib/pipefy";
import {
  calcularEnxoval,
  escolherFornecedor,
  KITS,
  type Cluster,
  type Fornecedor,
  type ResultadoCalculo,
} from "./calc";
import auxiCidadeData from "./data/auxi-cidade.json";
import bdProprietarioData from "./data/bd-proprietario.json";
import baseFranquiasData from "./data/base-franquias.json";
import enderecosStaysData from "./data/enderecos-stays.json";
import imovelAnfitriaoData from "./data/imovel-anfitriao.json";
import clusterEnxovalData from "./data/cluster-enxoval.json";

const PIPE_VISTORIAS_ID = "302290867";

type AuxiCidade = { cidade: string | null; regiao_full: string | null };
type Proprietario = { nome: string | null; telefone: string | null; documento_tipo: "CPF" | "CNPJ"; documento: string };
type FranquiaInfo = { telefone: string | null; uf: string | null; cep: string | null; endereco: string | null; cidade: string | null };
type StaysInfo = { capital: string | null; regiao: string | null };
type AnfitriaoInfo = { anfitriao: string | null; status: string | null };

const AUXI: Record<string, AuxiCidade> = auxiCidadeData as Record<string, AuxiCidade>;
const PROPRIETARIO: Record<string, Proprietario> = bdProprietarioData as Record<string, Proprietario>;
const FRANQUIA: Record<string, FranquiaInfo> = baseFranquiasData as Record<string, FranquiaInfo>;
const STAYS: Record<string, StaysInfo> = enderecosStaysData as Record<string, StaysInfo>;
const ANFITRIAO: Record<string, AnfitriaoInfo> = imovelAnfitriaoData as Record<string, AnfitriaoInfo>;
const CLUSTER_BY_CITY: Record<string, string> = clusterEnxovalData as Record<string, string>;

export type VistoriaCard = {
  id: string;
  title: string;
  phaseName: string;
  responsavel: string | null;
  dataAgendamento: string | null;
  motivo: string | null;
  // Quantidades por kit (cod → qtd)
  kits: Record<string, number>;
};

export type EnxovalSnapshot = {
  codigoImovel: string;
  proprietario: { nome: string; telefone: string; documentoTipo: "CPF" | "CNPJ"; documento: string };
  franquia: {
    nome: string;
    telefone: string;
    endereco: string;
    cidade: string;
    uf: string;
    cep: string;
    capital: boolean;
    regiao: string;
  };
  cluster: Cluster;
  fornecedor: Fornecedor;
  numeroTrocas: number;
  kits: Record<string, number>; // cod → qtd no imóvel
  vistoriaCardId: string;
  resultado: ResultadoCalculo;
};

const VISTORIA_FIELDS_TO_KIT: Record<string, string> = {
  cama_solteiro: "0.1",
  cama_casal: "0.2",
  cama_queen: "0.3",
  cama_king: "0.4",
  sof_cama_solteiro: "0.5",
  sof_cama_casal: "0.6",
  banheiros: "0.7",
  lavabos: "0.8",
  jacuzzis_banheira: "0.9",
  cozinhas: "0.10",
  toalha_maquiagem: "0.11",
};

function parseQty(value: string | null | undefined): number {
  if (!value) return 0;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Busca todos os cards do PIPE 3 (Vistorias) com title igual ao código.
 * Retorna lista crua pro frontend escolher quando há mais de um.
 */
export async function listVistoriaCards(code: string): Promise<VistoriaCard[]> {
  const query = `{
    cards(pipe_id: ${PIPE_VISTORIAS_ID}, search: { title: "${sanitizeGraphQL(code)}" }, first: 50) {
      edges {
        node {
          id
          title
          current_phase { id name }
          fields {
            field { id }
            value
            report_value
          }
        }
      }
    }
  }`;
  const res = await pipefyQuery(query);
  const edges = res.data?.cards?.edges || [];
  const upper = code.toUpperCase().trim();
  return edges
    .filter((e: { node: { title: string } }) => e.node.title.toUpperCase().trim() === upper)
    .map((e: { node: { id: string; title: string; current_phase: { name: string }; fields: Array<{ field: { id: string }; value: string | null; report_value: string | null }> } }) => {
      const node = e.node;
      const byId: Record<string, string> = {};
      for (const f of node.fields) {
        if (f.field?.id) byId[f.field.id] = f.value ?? f.report_value ?? "";
      }
      const kits: Record<string, number> = {};
      for (const [fieldId, kitCod] of Object.entries(VISTORIA_FIELDS_TO_KIT)) {
        kits[kitCod] = parseQty(byId[fieldId]);
      }
      return {
        id: node.id,
        title: node.title,
        phaseName: node.current_phase?.name ?? "",
        responsavel: byId["anfitri_o_respons_vel"] || byId["respons_vel_pela_implanta_o"] || null,
        dataAgendamento: byId["data_de_agendamento"] || null,
        motivo: byId["copy_of_tipo_da_vistoria"] || null,
        kits,
      } as VistoriaCard;
    });
}

function pickStaysInfo(cidade: string | null, uf: string | null): StaysInfo {
  if (cidade && uf) {
    const key = `${cidade}/${uf}`;
    if (STAYS[key]) return STAYS[key];
  }
  return { capital: null, regiao: null };
}

function inferCluster(codigo: string, cidadeFranquia: string | null): Cluster {
  const aux = AUXI[codigo];
  // ordem: cidade do imóvel (auxi) → cidade da franquia → fallback Padrão
  const candidates = [aux?.cidade, cidadeFranquia].filter(Boolean) as string[];
  for (const c of candidates) {
    const cl = CLUSTER_BY_CITY[c.trim()];
    if (cl) return cl as Cluster;
  }
  return "Padrão";
}

function isCapital(staysCapital: string | null): boolean {
  return (staysCapital ?? "").trim().toLowerCase() === "sim";
}

// Tenta achar a franquia em base-franquias.json:
// 1) exato, 2) case-insensitive, 3) prefixo único (cobre nome truncado tipo "Luila" → "Luila Chiste Lage").
function resolveFranquia(
  nome: string
): { nome: string; info: FranquiaInfo } | null {
  const trimmed = nome.trim();
  if (!trimmed) return null;
  if (FRANQUIA[trimmed]) return { nome: trimmed, info: FRANQUIA[trimmed] };
  const lower = trimmed.toLowerCase();
  const keys = Object.keys(FRANQUIA);
  const ci = keys.find((k) => k.toLowerCase() === lower);
  if (ci) return { nome: ci, info: FRANQUIA[ci] };
  const prefix = keys.filter((k) => k.toLowerCase().startsWith(lower));
  if (prefix.length === 1) return { nome: prefix[0], info: FRANQUIA[prefix[0]] };
  return null;
}

/**
 * Constrói o snapshot completo a partir do código + cardId vistoria.
 * Tudo derivado: proprietário, franquia, cluster, fornecedor, frete, valores.
 */
export async function deriveEnxovalSnapshot(
  codigo: string,
  vistoriaCardId: string
): Promise<EnxovalSnapshot> {
  const cards = await listVistoriaCards(codigo);
  const card = cards.find((c) => c.id === vistoriaCardId);
  if (!card) {
    throw new Error(
      `Card de vistoria ${vistoriaCardId} não encontrado para o código ${codigo}.`
    );
  }

  const prop = PROPRIETARIO[codigo] ?? {
    nome: "",
    telefone: "",
    documento_tipo: "CPF" as const,
    documento: "",
  };

  // Anfitrião/franquia: tenta resolver pelo nome do card vistoria; se vier
  // truncado/diferente do registrado em base-franquias, cai pra ANFITRIAO[codigo]
  // (nome canônico) e por fim pra match case-insensitive/prefixo único.
  const nomeCard = (card.responsavel ?? "").trim();
  const nomeAnfitriao = (ANFITRIAO[codigo]?.anfitriao ?? "").trim();
  const resolved =
    resolveFranquia(nomeCard) || resolveFranquia(nomeAnfitriao);
  if (!resolved) {
    const tentado = nomeCard || nomeAnfitriao || "(vazia)";
    throw new Error(
      `Franquia "${tentado}" não encontrada na Base franquias para o imóvel ${codigo}.`
    );
  }
  const nomeFranquia = resolved.nome;
  const franquiaInfo = resolved.info;

  const stays = pickStaysInfo(franquiaInfo.cidade, franquiaInfo.uf);
  const capital = isCapital(stays.capital);
  const regiao = (stays.regiao ?? "").trim();
  const fornecedor = escolherFornecedor(regiao);
  const cluster = inferCluster(codigo, franquiaInfo.cidade);

  const resultado = calcularEnxoval(
    card.kits,
    cluster,
    fornecedor,
    franquiaInfo.uf,
    capital
  );

  return {
    codigoImovel: codigo,
    proprietario: {
      nome: prop.nome ?? "",
      telefone: prop.telefone ?? "",
      documentoTipo: prop.documento_tipo,
      documento: prop.documento ?? "",
    },
    franquia: {
      nome: nomeFranquia,
      telefone: franquiaInfo.telefone ?? "",
      endereco: franquiaInfo.endereco ?? "",
      cidade: franquiaInfo.cidade ?? "",
      uf: franquiaInfo.uf ?? "",
      cep: franquiaInfo.cep ?? "",
      capital,
      regiao,
    },
    cluster,
    fornecedor,
    numeroTrocas: 3,
    kits: card.kits,
    vistoriaCardId,
    resultado,
  };
}

export { KITS };
