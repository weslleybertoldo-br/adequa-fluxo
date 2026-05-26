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
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
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
    const SHEET_NAME = "Base";

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:Z`,
    });
    const values = response.data.values || [];

    const colIndexToLetter = (c: number) => String.fromCharCode(65 + c);
    const findMatches = (codigo: string) => {
      const matches: Array<{ row: number; col: number }> = [];
      if (!codigo) return matches;
      const target = codigo.trim();
      for (let r = 0; r < values.length; r++) {
        const row = values[r] || [];
        for (let c = 0; c < row.length; c++) {
          if (String(row[c]).trim() === target) {
            matches.push({ row: r + 1, col: c });
          }
        }
      }
      return matches;
    };

    const matchesAntigo = findMatches(codigoAntigo);
    const matchesNovo = findMatches(codigoNovo);

    const sheetsAntigo = matchesAntigo.length > 0 ? [SHEET_NAME] : [];
    const sheetsNovo = matchesNovo.length > 0 ? [SHEET_NAME] : [];

    let atualizado = false;
    let linhasAtualizadas = 0;
    if (codigoAntigo && codigoNovo && matchesAntigo.length > 0 && matchesNovo.length === 0) {
      const iniciaisNovas = (codigoNovo.match(/^([A-Za-z]+)/)?.[1] || "").toUpperCase();
      const data: Array<{ range: string; values: string[][] }> = [];
      const linhasVistas = new Set<number>();
      for (const m of matchesAntigo) {
        data.push({
          range: `${SHEET_NAME}!${colIndexToLetter(m.col)}${m.row}`,
          values: [[codigoNovo]],
        });
        if (iniciaisNovas && !linhasVistas.has(m.row)) {
          data.push({
            range: `${SHEET_NAME}!E${m.row}`,
            values: [[iniciaisNovas]],
          });
          linhasVistas.add(m.row);
        }
      }
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { valueInputOption: "USER_ENTERED", data },
      });
      atualizado = true;
      linhasAtualizadas = linhasVistas.size;
    }

    const resultados = {
      codigoAntigo: { encontrado: sheetsAntigo.length > 0, sheets: sheetsAntigo },
      codigoNovo: { encontrado: sheetsNovo.length > 0, sheets: sheetsNovo },
    };

    let mensagem = "";
    if (atualizado) {
      mensagem = `Código atualizado de ${codigoAntigo} para ${codigoNovo} em ${linhasAtualizadas} linha(s) na aba Base`;
    } else if (resultados.codigoAntigo.encontrado && resultados.codigoNovo.encontrado) {
      mensagem = `Ambos códigos existem na planilha (${sheetsAntigo.join(", ")}) — nenhuma alteração feita`;
    } else if (resultados.codigoAntigo.encontrado) {
      mensagem = `Código antigo encontrado em: ${sheetsAntigo.join(", ")}`;
    } else if (resultados.codigoNovo.encontrado) {
      mensagem = `Código novo já cadastrado em: ${sheetsNovo.join(", ")} — nada a fazer`;
    } else {
      mensagem = "Nenhum código encontrado na planilha";
    }

    return NextResponse.json({
      success: true,
      resultados,
      mensagem,
      atualizado,
      linhasAtualizadas,
    });
  } catch (error: any) {
    return errorResponse(error, { fallback: "Erro ao validar planilha", status: 500 });
  }
}
