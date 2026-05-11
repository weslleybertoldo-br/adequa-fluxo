import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import { google } from "googleapis";

// ID da planilha do Google Sheets
const SPREADSHEET_ID = "1okEa2-ZzgsbTHFwr8ffB1LEP-XviMmGa4e6XtmdhdkY";

// Service Account credentials
function getSheetsClient() {
  // Support both file path and JSON string
  let credentials: any;
  const credsEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const credsPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;

  if (credsEnv) {
    credentials = JSON.parse(credsEnv);
  } else if (credsPath) {
    const fs = require("fs");
    credentials = JSON.parse(fs.readFileSync(credsPath, "utf8"));
  } else {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON ou GOOGLE_SERVICE_ACCOUNT_PATH não configurado");
  }
  const auth = new google.auth.GoogleAuth({
    credentials: credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({ version: "v4", auth });
}

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

    const sheets = getSheetsClient();

    // Apenas buscar na aba "Base"
    const SHEET_NAME = "Base";

    const buscarCodigo = async (codigo: string): Promise<string[]> => {
      const sheetsEncontrados: string[] = [];

      try {
        // Buscar todos os dados da aba Base
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_NAME}!A:Z`,
        });

        const values = response.data.values || [];

        // Procurar o código em todas as células
        for (const row of values) {
          for (const cell of row) {
            if (String(cell).trim() === codigo.trim()) {
              if (!sheetsEncontrados.includes(SHEET_NAME)) {
                sheetsEncontrados.push(SHEET_NAME);
              }
              break;
            }
          }
        }
      } catch (err) {
        console.error(`[validar-planilha] Erro ao buscar na aba ${SHEET_NAME}:`, err);
      }

      return sheetsEncontrados;
    };

    // Buscar ambos os códigos
    const [sheetsAntigo, sheetsNovo] = await Promise.all([
      codigoAntigo ? buscarCodigo(codigoAntigo) : [],
      codigoNovo ? buscarCodigo(codigoNovo) : [],
    ]);

    const resultados = {
      codigoAntigo: {
        encontrado: sheetsAntigo.length > 0,
        sheets: sheetsAntigo,
      },
      codigoNovo: {
        encontrado: sheetsNovo.length > 0,
        sheets: sheetsNovo,
      },
    };

    // Gerar mensagem detalhada
    let mensagem = "";
    if (resultados.codigoAntigo.encontrado && resultados.codigoNovo.encontrado) {
      mensagem = `Ambos códigos existem na planilha (${sheetsAntigo.join(", ")})`;
    } else if (resultados.codigoAntigo.encontrado) {
      mensagem = `Código antigo encontrado em: ${sheetsAntigo.join(", ")}`;
    } else if (resultados.codigoNovo.encontrado) {
      mensagem = `Código novo encontrado em: ${sheetsNovo.join(", ")}`;
    } else {
      mensagem = "Nenhum código encontrado na planilha";
    }

    return NextResponse.json({
      success: true,
      resultados,
      mensagem,
    });
  } catch (error: any) {
    return errorResponse(error, { fallback: "Erro ao validar planilha", status: 500 });
  }
}
