import { NextRequest, NextResponse } from "next/server";
import { pipefyQuery, requireAuth, PHASE_5_ID } from "@/lib/pipefy";

// Buscar cards da Fase 5 com o campo de registro de enxoval
async function getCardsWithEnxovalInfo(): Promise<any[]> {
  // Buscar com fields para verificar se tem registro de enxoval conectado
  let allCards: any[] = [];
  let cursor: string | undefined;
  let pages = 0;

  while (pages < 50) {
    const afterClause = cursor ? `, after: "${cursor}"` : "";
    const result = await pipefyQuery(`{
      phase(id: ${PHASE_5_ID}) {
        cards(first: 50${afterClause}) {
          edges {
            node {
              id
              title
              labels { id name }
              attachments { path url createdAt }
              fields {
                name
                value
                connected_repo_items {
                  ... on TableRecord { id title }
                  ... on Card { id title }
                }
              }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    }`);

    const data = result?.data?.phase?.cards;
    const edges = data?.edges || [];
    if (edges.length === 0) break;

    allCards = [...allCards, ...edges.map((e: any) => e.node)];

    if (!data?.pageInfo?.hasNextPage) break;
    cursor = data.pageInfo.endCursor;
    if (!cursor) break;
    pages++;
  }

  return allCards;
}

export async function GET(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const cards = await getCardsWithEnxovalInfo();

    const result = cards.map((card) => {
      const enxovalField = (card.fields || []).find(
        (f: any) => f.name?.toLowerCase().includes("registro de enxoval")
      );
      const connectedItems = enxovalField?.connected_repo_items || [];
      const hasRecord = connectedItems.length > 0 && !!connectedItems[0]?.id;
      const recordId = hasRecord ? connectedItems[0].id : "";

      // Lista anexos PDF do card (filtrar apenas .pdf)
      const attachments = (card.attachments || [])
        .map((a: { path: string; url: string; createdAt: string | null }) => {
          const fileName = a.path.split("/").pop() || a.path;
          return {
            fileName,
            path: a.path,
            url: a.url,
            createdAt: a.createdAt,
          };
        })
        .filter((a: { fileName: string }) => a.fileName.toLowerCase().endsWith(".pdf"))
        .sort(
          (a: { createdAt: string | null }, b: { createdAt: string | null }) => {
            if (!a.createdAt && !b.createdAt) return 0;
            if (!a.createdAt) return 1;
            if (!b.createdAt) return -1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
        );

      // Default: anexo que contenha "enxoval" E "geral" no nome (em qualquer ordem,
      // com qualquer separador). Ex.: "VEM0308-enxoval(GERAL).pdf", "Enxoval - Geral.pdf"
      const exactGeral = attachments.find((a: { fileName: string }) => {
        const f = a.fileName.toLowerCase();
        return f.includes("enxoval") && f.includes("geral");
      });
      const anyEnxoval = attachments.find((a: { fileName: string }) =>
        a.fileName.toLowerCase().includes("enxoval")
      );
      const defaultPdf = exactGeral || anyEnxoval || null;

      const hasGeral = !!exactGeral;
      return {
        id: card.id,
        title: card.title,
        labels: (card.labels || []).map((l: any) => l.name),
        hasRecord,
        recordId,
        attachments,
        defaultPdf: defaultPdf
          ? { fileName: defaultPdf.fileName, path: defaultPdf.path }
          : null,
        hasGeral,
      };
    });

    // Ordenar: GERAL anexado primeiro (sem registro), sem registro depois,
    // com registro por ultimo. Dentro de cada grupo, alfabetico.
    result.sort((a, b) => {
      const ag = !a.hasRecord && a.hasGeral ? 0 : !a.hasRecord ? 1 : 2;
      const bg = !b.hasRecord && b.hasGeral ? 0 : !b.hasRecord ? 1 : 2;
      if (ag !== bg) return ag - bg;
      return a.title.localeCompare(b.title);
    });

    return NextResponse.json({
      success: true,
      totalCards: result.length,
      withRecord: result.filter((r) => r.hasRecord).length,
      withoutRecord: result.filter((r) => !r.hasRecord).length,
      cards: result,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
