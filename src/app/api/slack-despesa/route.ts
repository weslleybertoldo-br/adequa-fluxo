import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import { SLACK } from "@/lib/config";

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN || "";
const CHANNEL_ID = SLACK.CHANNEL_ENXOVAL; // despesas-implantação
const BRUNO_ID = SLACK.USER_BRUNO;
const WESLLEY_ID = SLACK.USER_WESLLEY;

export async function POST(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const { codigo, franquia, data } = await req.json();

    if (!codigo || !franquia || !data) {
      return NextResponse.json({ error: "Campos obrigatórios: código, franquia, data" }, { status: 400 });
    }

    if (!SLACK_TOKEN) {
      return NextResponse.json({ error: "SLACK_BOT_TOKEN não configurado" }, { status: 500 });
    }

    // Formatar data YYYY-MM-DD para DD/MM/YYYY
    let dataFormatada = data;
    if (data.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [y, m, d] = data.split("-");
      dataFormatada = `${d}/${m}/${y}`;
    }

    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `<@${BRUNO_ID}>, o imóvel *${codigo}* está liberado para lançamento de despesa.\n\n*Franquia responsável:* ${franquia}\n*Data que deve ser lançado:* ${dataFormatada}\n\nApós o lançamento, o card pode ser finalizado no pipe 1 :a-parrot:`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Despesa lançada", emoji: true },
            style: "primary",
            action_id: "despesa_lancada",
            value: WESLLEY_ID,
          },
        ],
      },
    ];

    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SLACK_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: CHANNEL_ID,
        text: `Lançamento de despesa - ${codigo}`,
        blocks,
      }),
    });

    const result = await res.json();
    if (!result.ok) throw new Error(`Slack: ${result.error}`);

    return NextResponse.json({ success: true, message: "Mensagem enviada no canal despesas-implantação" });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
