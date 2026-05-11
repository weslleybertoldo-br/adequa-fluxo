import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { pipefyQuery, requireAuth, PIPE_1_PHASES } from "@/lib/pipefy";

export async function GET(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Código obrigatório" }, { status: 400 });
  }

  try {
    for (const { id: phaseId } of PIPE_1_PHASES) {
      const result = await pipefyQuery(`{
        phase(id: ${phaseId}) {
          cards(first: 3, search: { title: "${JSON.stringify(code).slice(1, -1)}" }) {
            edges {
              node {
                title
                fields { name value }
              }
            }
          }
        }
      }`);

      const edges = result?.data?.phase?.cards?.edges || [];
      const card = edges.find((e: any) => e.node.title.toUpperCase() === code.toUpperCase());

      if (card) {
        const fields = card.node.fields || [];
        const field = fields.find((f: any) =>
          f.name?.toLowerCase() === "anfitrião escolhido"
        );

        if (field?.value) {
          return NextResponse.json({ success: true, franqueado: field.value });
        }
      }
    }

    return NextResponse.json({ success: true, franqueado: "" });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
