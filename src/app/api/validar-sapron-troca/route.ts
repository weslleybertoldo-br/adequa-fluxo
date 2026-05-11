import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";

const SAPRON_API_KEY = "85Rjs5I1QCLQRlWfncYkBbFOeYOn5iXiczeKMfcswao";
const SAPRON_BASE_URL = "https://api.sapron.com.br";

export async function GET(request: NextRequest) {
  const authToken = request.cookies.get("auth_token")?.value;
  if (!requireAuth(authToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const codigoAntigo = searchParams.get("codigoAntigo") || "";
    const codigoNovo = searchParams.get("codigoNovo") || "";

    if (!codigoAntigo && !codigoNovo) {
      return NextResponse.json({ error: "Código não fornecido" }, { status: 400 });
    }

    // Buscar todos os imóveis no Sapron
    const response = await fetch(`${SAPRON_BASE_URL}/properties/properties_list/`, {
      headers: {
        "X-SAPRON-API-KEY": SAPRON_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Sapron API retornou ${response.status}`);
    }

    const properties: Array<{ id: number; code: string; status: string }> = await response.json();

    // Verificar se o código antigo ainda existe
    const encontradoAntigo = properties.find(
      (p) => p.code.toUpperCase() === codigoAntigo.toUpperCase()
    );

    // Verificar se o código novo já existe
    const encontradoNovo = properties.find(
      (p) => p.code.toUpperCase() === codigoNovo.toUpperCase()
    );

    // Determinar o status da troca
    let statusTroca: "nao_iniciado" | "parcial" | "completo" | "erro";
    let mensagem: string;

    if (encontradoAntigo && encontradoNovo) {
      statusTroca = "erro";
      mensagem = `ERRO: Ambos códigos existem (Antigo: ${codigoAntigo}, Novo: ${codigoNovo}) - não deveria ter ambos`;
    } else if (encontradoAntigo && !encontradoNovo) {
      statusTroca = "nao_iniciado";
      mensagem = `Código antigo (${codigoAntigo}) ainda existe, código novo (${codigoNovo}) não encontrado - troca não realizada`;
    } else if (!encontradoAntigo && encontradoNovo) {
      statusTroca = "completo";
      mensagem = `Código novo (${codigoNovo}) encontrado, código antigo (${codigoAntigo}) não existe - troca já realizada`;
    } else {
      statusTroca = "nao_iniciado";
      mensagem = `Nenhum dos códigos encontrados no Sapron (Antigo: ${codigoAntigo}, Novo: ${codigoNovo})`;
    }

    return NextResponse.json({
      success: true,
      statusTroca,
      mensagem,
      detalhes: {
        codigoAntigo: {
          encontrado: !!encontradoAntigo,
          id: encontradoAntigo?.id || null,
          status: encontradoAntigo?.status || null,
        },
        codigoNovo: {
          encontrado: !!encontradoNovo,
          id: encontradoNovo?.id || null,
          status: encontradoNovo?.status || null,
        },
      },
    });
  } catch (error: any) {
    return errorResponse(error, { fallback: "Erro ao verificar Sapron", status: 500 });
  }
}
