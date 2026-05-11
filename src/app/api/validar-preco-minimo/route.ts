import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import { google } from "googleapis";

// Planilha "Preço Mínimo"
const SPREADSHEET_ID = "1-8dWhTBZCr6ipVfd0Wtp1KcymHZ2uzOIQ6jOsIpqNec";

function getSheetsClient() {
  let credentials: any;
  const credsEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const credsPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;

  if (credsEnv) {
    credentials = JSON.parse(credsEnv);
  } else if (credsPath) {
    const fs = require("fs");
    credentials = JSON.parse(fs.readFileSync(credsPath, "utf8"));
  } else {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON ou GOOGLE_SERVICE_ACCOUNT_PATH não configurado na Vercel"
    );
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
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
    const codigoAntigo = (searchParams.get("codigoAntigo") || "").trim();
    const codigoNovo = (searchParams.get("codigoNovo") || "").trim();
    if (!codigoAntigo && !codigoNovo) {
      return NextResponse.json({ error: "Código não fornecido" }, { status: 400 });
    }

    const sheets = getSheetsClient();

    // 1) Listar todas as abas da planilha (não temos um nome de aba fixo aqui)
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheetTitles = (meta.data.sheets || [])
      .map((s) => s.properties?.title)
      .filter((t): t is string => typeof t === "string" && !!t);

    // 2) Buscar cada código em cada aba (em paralelo, batchGet com todos os ranges)
    const ranges = sheetTitles.map((t) => `'${t.replace(/'/g, "''")}'!A:Z`);
    const batch = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges,
    });

    const buscarCodigo = (codigo: string): string[] => {
      if (!codigo) return [];
      const alvo = codigo.trim().toUpperCase();
      const found: string[] = [];
      const valueRanges = batch.data.valueRanges || [];
      for (let i = 0; i < valueRanges.length; i++) {
        const sheetName = sheetTitles[i];
        const values = valueRanges[i].values || [];
        let match = false;
        for (const row of values) {
          for (const cell of row) {
            if (typeof cell !== "undefined" && String(cell).trim().toUpperCase() === alvo) {
              match = true;
              break;
            }
          }
          if (match) break;
        }
        if (match) found.push(sheetName);
      }
      return found;
    };

    const sheetsAntigo = codigoAntigo ? buscarCodigo(codigoAntigo) : [];
    const sheetsNovo = codigoNovo ? buscarCodigo(codigoNovo) : [];

    let mensagem: string;
    if (sheetsAntigo.length > 0 && sheetsNovo.length > 0) {
      mensagem = `Ambos códigos têm preço mínimo (antigo: ${sheetsAntigo.join(", ")} | novo: ${sheetsNovo.join(", ")})`;
    } else if (sheetsAntigo.length > 0) {
      mensagem = `Código antigo "${codigoAntigo}" tem preço mínimo (aba: ${sheetsAntigo.join(", ")})`;
    } else if (sheetsNovo.length > 0) {
      mensagem = `Código novo "${codigoNovo}" tem preço mínimo (aba: ${sheetsNovo.join(", ")})`;
    } else {
      mensagem = "Nenhum código tem preço mínimo cadastrado";
    }

    return NextResponse.json({
      success: true,
      resultados: {
        codigoAntigo: { encontrado: sheetsAntigo.length > 0, sheets: sheetsAntigo },
        codigoNovo: { encontrado: sheetsNovo.length > 0, sheets: sheetsNovo },
      },
      mensagem,
    });
  } catch (error: any) {
    return errorResponse(error, { fallback: "Erro ao validar planilha de Preço Mínimo", status: 500 });
  }
}
