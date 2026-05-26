import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import {
  listarSuportesTroca,
  extrairCamposTroca,
  statusParaFase,
  urlSuporteCard,
  type FaseUI,
} from "@/lib/suporte-ops";

// Formato esperado pelo frontend (compatível com a versão antiga que vinha do Pipefy):
// { phases: [{id, name}], cardsByPhase: { Backlog: [...], Fazendo: [...], Concluído: [...] } }

export async function GET(request: NextRequest) {
  const authToken = request.cookies.get("auth_token")?.value;
  if (!requireAuth(authToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim().toUpperCase();

    const raws = await listarSuportesTroca();

    // Mapa code → status do imóvel (Sapron), 1 fetch da lista inteira.
    // Usado pra deduzir "Status do Imóvel" em cards que ainda não foram pra "Aguardando".
    const sapronStatusByCode = new Map<string, string>();
    try {
      const r = await fetch("https://api.sapron.com.br/properties/properties_list/", {
        headers: { "X-SAPRON-API-KEY": "85Rjs5I1QCLQRlWfncYkBbFOeYOn5iXiczeKMfcswao" },
      });
      if (r.ok) {
        const props: Array<{ code: string; status: string }> = await r.json();
        for (const p of props) {
          if (p?.code) {
            sapronStatusByCode.set(p.code.toUpperCase(), p.status === "Active" ? "Ativo" : "Implantação");
          }
        }
      }
    } catch (err) {
      console.error("[list-troca-codigo] Sapron properties_list falhou:", err);
    }

    const phases: { id: string; name: FaseUI }[] = [
      { id: "novo", name: "Novo" },
      { id: "em_andamento", name: "Em Andamento" },
      { id: "aguardando", name: "Aguardando" },
      { id: "concluido", name: "Concluído" },
      { id: "arquivado", name: "Arquivado" },
    ];

    const cardsByPhase: Record<string, any[]> = {
      Novo: [],
      "Em Andamento": [],
      Aguardando: [],
      "Concluído": [],
      Arquivado: [],
    };

    for (const card of raws) {
      const fase = statusParaFase(card.status);
      if (!fase) continue;

      const campos = extrairCamposTroca(card);

      // Deduz status do imóvel via Sapron quando o card ainda não tem (fases Novo/Em Andamento).
      // Prefere o código novo (estado pós-troca); fallback antigo.
      if (!campos.statusImovel) {
        campos.statusImovel =
          sapronStatusByCode.get((campos.codigoNovo || "").toUpperCase()) ||
          sapronStatusByCode.get((campos.codigoAntigo || "").toUpperCase()) ||
          "";
      }

      // Filtro de pesquisa: aceita match em codigoAntigo, codigoNovo ou codigo_imovel
      if (search) {
        const haystack = [
          campos.codigoAntigo,
          campos.codigoNovo,
          card.codigo_imovel || "",
        ]
          .join("|")
          .toUpperCase();
        if (!haystack.includes(search)) continue;
      }

      cardsByPhase[fase].push({
        id: card.id,
        // Pra compatibilidade com o componente antigo que mostrava "card.title"
        // exibimos o código antigo (que é o que importa pra troca).
        title: campos.codigoAntigo || card.codigo_imovel || "SEM-CODIGO",
        due_date: card.sla_deadline,
        url: urlSuporteCard(card.id),
        status: card.status,
        urgencia: card.urgencia,
        descricao: card.descricao,
        created_at: card.created_at,
        updated_at: card.updated_at,
        slack_ts: card.slack_ts,
        slack_channel: card.slack_channel,
        // Campos no formato que o componente CardTrocaCode espera (`fields[]` com {name,value})
        fields: [
          { name: "Código Antigo", value: campos.codigoAntigo },
          { name: "Novo Código", value: campos.codigoNovo },
          { name: "Quem Solicitou", value: campos.solicitante },
          { name: "Observação", value: campos.observacao },
          { name: "Status do Imóvel", value: campos.statusImovel },
          { name: "Motivo da troca", value: "" },
          { name: "Id do imóvel antigo", value: "" },
          { name: "Id do imóvel novo", value: "" },
        ],
        // Status pré-calculados que o frontend usa pra preencher o tracker
        statusFlags: {
          alteradoBaseCodigo: campos.alteradoBaseCodigo,
          alteradoSapron: campos.alteradoSapron,
          alteradoPipefy: campos.alteradoPipefy,
          alteradoStays: campos.alteradoStays,
          alteradoPipedrive: campos.alteradoPipedrive,
          alteradoOtas: campos.alteradoOtas,
          alteradoPipefyCsProp: campos.alteradoPipefyCsProp,
        },
      });
    }

    return NextResponse.json({
      success: true,
      source: "suporte-ops",
      phases,
      cardsByPhase,
    });
  } catch (error: any) {
    return errorResponse(error, { fallback: "Erro ao buscar suportes", status: 500 });
  }
}
