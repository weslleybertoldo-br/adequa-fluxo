import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import { errorResponse } from "@/lib/errors";

// Bot token nao esta no canal #suporte-operação (`not_in_channel`).
// User token (xoxp) consegue ler como o usuario logado.
const SLACK_USER_TOKEN = process.env.SLACK_USER_TOKEN || "";
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || "";

interface SlackUser {
  id: string;
  name: string;
}

interface SlackReaction {
  name: string;
  emoji: string; // unicode (✅ pra white_check_mark)
  users: SlackUser[];
}

interface SlackMessage {
  ts: string;
  time: string; // HH:MM BRT
  iso: string; // ISO completo
  text: string;
  user: SlackUser | null;
  reactions: SlackReaction[];
  isTemplateEnviar: boolean; // mensagem do botao enviar
  isStatusChange: boolean; // mensagens "Em Andamento" / "Aguardando"
  isRoot: boolean; // primeira da thread (Novo Suporte)
}

const userCache = new Map<string, SlackUser>();

async function resolveUser(userId: string): Promise<SlackUser> {
  if (userCache.has(userId)) return userCache.get(userId)!;
  try {
    const r = await fetch(
      `https://slack.com/api/users.info?user=${encodeURIComponent(userId)}`,
      { headers: { Authorization: `Bearer ${SLACK_USER_TOKEN}` } }
    );
    const d = await r.json();
    if (d.ok && d.user) {
      const u: SlackUser = {
        id: userId,
        name: d.user.real_name || d.user.name || userId,
      };
      userCache.set(userId, u);
      return u;
    }
  } catch {}
  const fallback = { id: userId, name: userId };
  userCache.set(userId, fallback);
  return fallback;
}

function brTimeFromTs(ts: string): { time: string; iso: string } {
  const sec = parseFloat(ts);
  const d = new Date(sec * 1000);
  // BRT = UTC-3
  const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const hh = String(brt.getUTCHours()).padStart(2, "0");
  const mm = String(brt.getUTCMinutes()).padStart(2, "0");
  return { time: `${hh}:${mm}`, iso: d.toISOString() };
}

// Slack name → unicode (so :white_check_mark: vira ✅ na UI).
// Lista enxuta com os mais comuns que aparecem no canal #suporte-operação.
const EMOJI_MAP: Record<string, string> = {
  white_check_mark: "✅",
  heavy_check_mark: "✔️",
  ballot_box_with_check: "☑️",
  x: "❌",
  heavy_multiplication_x: "✖️",
  warning: "⚠️",
  no_entry: "⛔",
  no_entry_sign: "🚫",
  thumbsup: "👍",
  "+1": "👍",
  thumbsdown: "👎",
  "-1": "👎",
  eyes: "👀",
  raised_hands: "🙌",
  pray: "🙏",
  clap: "👏",
  ok_hand: "👌",
  rocket: "🚀",
  fire: "🔥",
  tada: "🎉",
  bell: "🔔",
  speech_balloon: "💬",
  arrows_counterclockwise: "🔄",
  hourglass_flowing_sand: "⏳",
  hourglass: "⌛",
  large_orange_circle: "🟠",
  large_yellow_circle: "🟡",
  large_green_circle: "🟢",
  large_red_circle: "🔴",
  large_blue_circle: "🔵",
  question: "❓",
  exclamation: "❗",
  bulb: "💡",
  hammer_and_wrench: "🛠️",
  computer: "💻",
  email: "📧",
  telephone: "📞",
  calendar: "📅",
  spiral_calendar_pad: "🗓️",
  pushpin: "📌",
  memo: "📝",
  link: "🔗",
  mag: "🔍",
  mag_right: "🔎",
  white_circle: "⚪",
  black_circle: "⚫",
  new: "🆕",
};

function emojiFor(name: string): string {
  return EMOJI_MAP[name] || `:${name}:`;
}

// Resolve <@USERID>, :emoji:, *bold*, _italic_ pra texto legivel.
async function cleanSlackText(text: string): Promise<string> {
  if (!text) return "";
  let out = text;

  // 1) Mentions <@USERID> → @Nome (resolve via users.info, com cache)
  const mentionRe = /<@([A-Z0-9]+)>/g;
  const mentionMatches = Array.from(out.matchAll(mentionRe));
  for (const m of mentionMatches) {
    const uid = m[1];
    const u = await resolveUser(uid);
    out = out.replace(m[0], `@${u.name}`);
  }

  // 2) Emojis :nome: → unicode
  out = out.replace(/:([a-z0-9_+-]+):/gi, (_, name) => emojiFor(name));

  // 3) *bold* → bold (strip asteriscos), _italic_ → italic (strip underscores)
  // Tira so quando flank por palavra/inicio/fim — evita destruir asterisco em URLs/codigo.
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;!?:]|$)/g, "$1$2");
  out = out.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;!?:]|$)/g, "$1$2");

  return out;
}

export async function GET(request: NextRequest) {
  const authToken = request.cookies.get("auth_token")?.value;
  if (!requireAuth(authToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = SLACK_USER_TOKEN || SLACK_BOT_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "SLACK_USER_TOKEN/SLACK_BOT_TOKEN nao configurado" },
      { status: 500 }
    );
  }

  const channel = (request.nextUrl.searchParams.get("channel") || "").trim();
  const ts = (request.nextUrl.searchParams.get("ts") || "").trim();
  const codigoAntigo = (
    request.nextUrl.searchParams.get("codigoAntigo") || ""
  ).trim();

  if (!channel || !ts) {
    return NextResponse.json(
      { error: "channel e ts obrigatorios" },
      { status: 400 }
    );
  }

  try {
    const r = await fetch(
      `https://slack.com/api/conversations.replies?channel=${encodeURIComponent(channel)}&ts=${encodeURIComponent(ts)}&limit=200`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await r.json();
    if (!data.ok) {
      return NextResponse.json(
        { error: `Slack: ${data.error}` },
        { status: 502 }
      );
    }

    const rawMsgs: any[] = data.messages || [];
    const msgs: SlackMessage[] = [];

    for (let i = 0; i < rawMsgs.length; i++) {
      const m = rawMsgs[i];
      const rawText = m.text || "";
      const { time, iso } = brTimeFromTs(m.ts);

      // Resolver author (m.user OU m.username pra bot/app)
      let user: SlackUser | null = null;
      if (m.user) {
        user = await resolveUser(m.user);
      } else if (m.username) {
        user = { id: m.bot_id || "bot", name: m.username };
      } else if (m.bot_id) {
        user = { id: m.bot_id, name: "Bot" };
      }

      // Resolver users em reactions + emoji unicode
      const reactions: SlackReaction[] = [];
      for (const r of m.reactions || []) {
        const users = await Promise.all(
          (r.users || []).map((uid: string) => resolveUser(uid))
        );
        reactions.push({ name: r.name, emoji: emojiFor(r.name), users });
      }

      // Limpa texto: <@USER> → @Nome, :emoji: → unicode, *bold*/_italic_ stripped
      const text = await cleanSlackText(rawText);

      // Heuristicas usam o rawText (antes do cleanup) pra nao depender da
      // tradução de emojis.
      const lower = rawText.toLowerCase();
      const isRoot = i === 0;
      const isStatusChange =
        rawText.includes(":arrows_counterclockwise:") ||
        rawText.includes(":hourglass_flowing_sand:") ||
        rawText.includes(":white_check_mark:") ||
        /Em Andamento|Aguardando|Concluído|Concluido|Arquivado/i.test(
          rawText.split("\n")[0] || ""
        );
      const isTemplateEnviar =
        lower.includes("troca de código está em andamento") ||
        lower.includes("troca de codigo esta em andamento") ||
        (codigoAntigo &&
          rawText.includes(codigoAntigo) &&
          lower.includes("status do imóvel"));

      msgs.push({
        ts: m.ts,
        time,
        iso,
        text,
        user,
        reactions,
        isTemplateEnviar: !!isTemplateEnviar,
        isStatusChange,
        isRoot,
      });
    }

    const templateMsg = msgs.find((m) => m.isTemplateEnviar) || null;

    // Cutoff pra "replies depois do Aguardando":
    //   1) Mensagem ":hourglass: Aguardando" se existir (caso o suporte-ops
    //      tenha feito repost da transicao no Slack);
    //   2) Mensagem do botao enviar (template) — proxy razoavel, ja que ela
    //      eh disparada exatamente quando o card entra em Aguardando;
    //   3) Sem cutoff: pega tudo exceto a raiz e status changes.
    const aguardandoIdx = msgs.findIndex(
      (m) => m.isStatusChange && /Aguardando/i.test(m.text)
    );
    let cutoffIdx = aguardandoIdx;
    if (cutoffIdx < 0 && templateMsg) {
      cutoffIdx = msgs.findIndex((m) => m.ts === templateMsg.ts);
    }
    const repliesAfterAguardando = (
      cutoffIdx >= 0 ? msgs.slice(cutoffIdx + 1) : msgs.slice(1)
    ).filter((m) => !m.isStatusChange && !m.isTemplateEnviar);

    return NextResponse.json({
      success: true,
      totalMessages: msgs.length,
      lastActivity: msgs.length > 0 ? msgs[msgs.length - 1].iso : null,
      lastActivityTime:
        msgs.length > 0 ? msgs[msgs.length - 1].time : null,
      templateMessage: templateMsg,
      repliesAfterAguardando,
      allMessages: msgs,
    });
  } catch (err: unknown) {
    return errorResponse(err, { context: "slack-thread-troca" });
  }
}
