const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export type DriveFolder = { id: string; name: string; parents?: string[] };
export type DriveFile = { id: string; name: string; mimeType: string; size?: string };

function commonParams(): string {
  return "supportsAllDrives=true&includeItemsFromAllDrives=true";
}

async function api(path: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(`${DRIVE_API}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function searchFolderByName(token: string, name: string): Promise<DriveFolder[]> {
  const q = `name = '${name.replace(/'/g, "\\'")}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const url = `/files?q=${encodeURIComponent(q)}&fields=files(id,name,parents)&${commonParams()}&pageSize=20`;
  const res = await api(url, token);
  if (!res.ok) throw new Error(`Drive search HTTP ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { files?: DriveFolder[] };
  return j.files || [];
}

export async function getFolder(token: string, id: string): Promise<DriveFolder> {
  const res = await api(`/files/${id}?fields=id,name,parents&${commonParams()}`, token);
  if (!res.ok) throw new Error(`Drive get HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()) as DriveFolder;
}

export async function listChildren(token: string, parentId: string, onlyFolders = false): Promise<DriveFile[]> {
  const qParts = [`'${parentId}' in parents`, "trashed = false"];
  if (onlyFolders) qParts.push(`mimeType = '${FOLDER_MIME}'`);
  const q = qParts.join(" and ");
  const all: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const url = `/files?q=${encodeURIComponent(q)}&fields=nextPageToken,files(id,name,mimeType,size)&${commonParams()}&pageSize=200${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await api(url, token);
    if (!res.ok) throw new Error(`Drive list HTTP ${res.status}: ${await res.text()}`);
    const j = (await res.json()) as { files?: DriveFile[]; nextPageToken?: string };
    if (j.files) all.push(...j.files);
    pageToken = j.nextPageToken;
  } while (pageToken);
  return all;
}

export async function findChildFolderByName(
  token: string,
  parentId: string,
  name: string,
): Promise<DriveFolder | null> {
  const q = `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const url = `/files?q=${encodeURIComponent(q)}&fields=files(id,name,parents)&${commonParams()}`;
  const res = await api(url, token);
  if (!res.ok) throw new Error(`Drive findChild HTTP ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { files?: DriveFolder[] };
  return j.files?.[0] || null;
}

export async function createFolder(token: string, name: string, parentId: string): Promise<DriveFolder> {
  const res = await api(`/files?${commonParams()}&fields=id,name,parents`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  });
  if (!res.ok) throw new Error(`Drive createFolder HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()) as DriveFolder;
}

export async function uploadFromUrl(
  token: string,
  parentId: string,
  fileName: string,
  sourceUrl: string,
): Promise<DriveFile> {
  const src = await fetch(sourceUrl);
  if (!src.ok) throw new Error(`Falha ao baixar do Sults: HTTP ${src.status}`);
  const buf = Buffer.from(await src.arrayBuffer());
  const contentType = src.headers.get("content-type") || "application/octet-stream";

  const boundary = "----pipefy-pendencias-" + Math.random().toString(36).slice(2);
  const metadata = { name: fileName, parents: [parentId] };
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`),
    buf,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await fetch(
    `${DRIVE_UPLOAD}/files?uploadType=multipart&${commonParams()}&fields=id,name,mimeType,size`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": String(body.length),
      },
      body,
    },
  );
  if (!res.ok) throw new Error(`Drive upload HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()) as DriveFile;
}

export function extractFolderId(input: string): string | null {
  const m = input.match(/\/folders\/([A-Za-z0-9_-]+)/) || input.match(/\?id=([A-Za-z0-9_-]+)/) || input.match(/^([A-Za-z0-9_-]{20,})$/);
  return m ? m[1] : null;
}
