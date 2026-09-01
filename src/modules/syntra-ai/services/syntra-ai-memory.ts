import { prisma } from "@/modules/core/db/prisma";

const SECRET_RE =
  /(password|passwd|api[_-]?key|secret|private[_-]?key|token|admin_passwd|sk-[a-zA-Z0-9])/i;
const SLUG_RE = /[^a-z0-9-]+/g;

export function slugifySkillName(name: string): string {
  const raw = (name || "").trim().toLowerCase().replace(/_/g, "-");
  return raw.replace(SLUG_RE, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "skill";
}

function rejectSecrets(text: string): string | null {
  return SECRET_RE.test(text) ? "No guardo secretos (contraseñas, API keys, tokens)." : null;
}

export async function buildMemoryAndSkillsPrompt(userId: string): Promise<string> {
  const [memories, skills] = await Promise.all([
    prisma.syntraAiMemory.findMany({
      where: {
        active: true,
        OR: [{ scope: "team" }, { scope: "personal", userId }],
      },
      orderBy: [{ scope: "asc" }, { title: "asc" }],
      take: 40,
    }),
    prisma.syntraAiSkill.findMany({
      where: {
        active: true,
        OR: [{ scope: "team" }, { scope: "personal", userId }],
      },
      orderBy: { name: "asc" },
      take: 40,
    }),
  ]);

  const parts: string[] = [];
  if (memories.length) {
    parts.push("## Memoria persistente");
    for (const m of memories) {
      parts.push(`- [${m.scope}] ${m.title}: ${m.content}`);
    }
  }
  if (skills.length) {
    parts.push("## Skills disponibles (usa load_skill si aplica)");
    for (const s of skills) {
      parts.push(`- ${s.name} (${s.scope}): ${s.description}`);
    }
  }
  return parts.join("\n");
}

export async function rememberFact(params: {
  userId: string;
  title: string;
  content: string;
  scope?: "personal" | "team";
  category?: string;
}): Promise<string> {
  const title = params.title.trim().slice(0, 120);
  const content = params.content.trim().slice(0, 4000);
  const secretErr = rejectSecrets(`${title}\n${content}`);
  if (secretErr) return secretErr;
  if (!title || !content) return "Faltan título o contenido.";

  const scope = params.scope === "team" ? "team" : "personal";
  const existing = await prisma.syntraAiMemory.findFirst({
    where: {
      title,
      scope,
      userId: scope === "personal" ? params.userId : null,
      active: true,
    },
  });

  if (existing) {
    await prisma.syntraAiMemory.update({
      where: { id: existing.id },
      data: { content, category: params.category || existing.category },
    });
    return scope === "team"
      ? `Actualicé la memoria de equipo «${title}» (visible para todos).`
      : `Actualicé la memoria «${title}».`;
  }

  await prisma.syntraAiMemory.create({
    data: {
      title,
      content,
      scope,
      category: params.category || "other",
      userId: scope === "personal" ? params.userId : null,
    },
  });
  return scope === "team"
    ? `Guardé en memoria de equipo: «${title}» (visible para todos los usuarios).`
    : `Guardé en memoria personal: «${title}».`;
}

export async function forgetMemory(params: {
  userId: string;
  title?: string;
  id?: string;
}): Promise<string> {
  const where = params.id
    ? { id: params.id }
    : {
        title: (params.title || "").trim(),
        OR: [{ scope: "team" }, { scope: "personal", userId: params.userId }],
        active: true,
      };

  const row = await prisma.syntraAiMemory.findFirst({ where });
  if (!row) return "No encontré ese hecho en memoria.";
  await prisma.syntraAiMemory.update({ where: { id: row.id }, data: { active: false } });
  return `Olvidé «${row.title}».`;
}

export async function saveSkill(params: {
  userId: string;
  name: string;
  description: string;
  body: string;
  scope?: "personal" | "team";
}): Promise<string> {
  const name = slugifySkillName(params.name);
  const description = params.description.trim().slice(0, 1024);
  const body = params.body.trim().slice(0, 12_000);
  const secretErr = rejectSecrets(`${name}\n${description}\n${body}`);
  if (secretErr) return secretErr;
  if (!description || !body) return "Faltan descripción o procedimiento.";

  const scope = params.scope === "personal" ? "personal" : "team";
  const userId = scope === "personal" ? params.userId : null;

  const existing = await prisma.syntraAiSkill.findFirst({
    where: { name, scope, userId },
  });
  if (existing) {
    await prisma.syntraAiSkill.update({
      where: { id: existing.id },
      data: { description, body, active: true },
    });
  } else {
    await prisma.syntraAiSkill.create({
      data: { name, description, body, scope, userId },
    });
  }
  return `Skill «${name}» guardado (${scope}).`;
}

export async function loadSkillBody(params: {
  userId: string;
  name?: string;
}): Promise<string | null> {
  const slug = slugifySkillName(params.name || "");
  const skill = await prisma.syntraAiSkill.findFirst({
    where: {
      name: slug,
      active: true,
      OR: [{ scope: "team" }, { scope: "personal", userId: params.userId }],
    },
  });
  if (!skill) return null;
  return `# ${skill.name}\n${skill.description}\n\n${skill.body}`;
}

const REMEMBER_RE = /\b(recuerda|guarda en memoria|memoriza|no olvides|remember)\b/i;
const FORGET_RE = /\b(olvida|ya no recuerdes|forget)\b/i;
const LEARN_RE = /\b(aprende|learn|\/learn)\b/i;

export async function tryHandleMemoryCommands(
  userId: string,
  message: string,
): Promise<string | null> {
  const msg = message.trim();
  if (!msg) return null;

  if (FORGET_RE.test(msg)) {
    const title = msg.replace(FORGET_RE, "").replace(/[:\-]/g, "").trim();
    return forgetMemory({ userId, title });
  }

  if (REMEMBER_RE.test(msg)) {
    const rest = msg.replace(REMEMBER_RE, "").replace(/^[:\-\s]+/, "").trim();
    const [title, ...contentParts] = rest.split(/[:\n]/);
    const content = contentParts.join(":").trim() || title;
    const scope = /\b(solo para mí|personal)\b/i.test(msg)
      ? "personal"
      : /\b(para todos|equipo|team|para el equipo)\b/i.test(msg)
        ? "team"
        : "personal";
    return rememberFact({
      userId,
      title: (title || "Hecho").trim(),
      content: content.trim(),
      scope,
    });
  }

  if (LEARN_RE.test(msg)) {
    const rest = msg.replace(LEARN_RE, "").replace(/^[:\-\s]+/, "").trim();
    const lines = rest.split("\n").map((l) => l.trim()).filter(Boolean);
    const name = lines[0]?.split(/[:\-]/)[0]?.trim() || "skill";
    const description = lines[0]?.includes(":") ? lines[0].split(":").slice(1).join(":").trim() : name;
    const body = lines.slice(1).join("\n").trim() || description;
    const scope = /\b(solo para mí|personal)\b/i.test(msg) ? "personal" : "team";
    return saveSkill({ userId, name, description, body, scope });
  }

  return null;
}

export type SyntraAiSkillRow = {
  id: string;
  name: string;
  description: string;
  scope: string;
  authorName: string | null;
  updatedAt: string;
};

export type SyntraAiMemoryRow = {
  id: string;
  title: string;
  content: string;
  scope: string;
  category: string;
  authorName: string | null;
  updatedAt: string;
};

export async function listSkillsBoard(userId: string) {
  const skills = await prisma.syntraAiSkill.findMany({
    where: {
      active: true,
      OR: [{ scope: "team" }, { scope: "personal", userId }],
    },
    orderBy: { name: "asc" },
    take: 80,
    include: { user: { select: { name: true } } },
  });

  const personal: SyntraAiSkillRow[] = [];
  const team: SyntraAiSkillRow[] = [];
  for (const s of skills) {
    const row: SyntraAiSkillRow = {
      id: s.id,
      name: s.name,
      description: s.description,
      scope: s.scope,
      authorName: s.user?.name ?? null,
      updatedAt: s.updatedAt.toISOString(),
    };
    if (s.scope === "team") team.push(row);
    else personal.push(row);
  }
  return { personal, team, counts: { personal: personal.length, team: team.length } };
}

/** Memoria visible al usuario: personal propia + equipo (compartida entre todos). */
export async function listMemoriesBoard(userId: string) {
  const memories = await prisma.syntraAiMemory.findMany({
    where: {
      active: true,
      OR: [{ scope: "team" }, { scope: "personal", userId }],
    },
    orderBy: [{ scope: "asc" }, { title: "asc" }],
    take: 80,
    include: { user: { select: { name: true } } },
  });

  const personal: SyntraAiMemoryRow[] = [];
  const team: SyntraAiMemoryRow[] = [];
  for (const m of memories) {
    const row: SyntraAiMemoryRow = {
      id: m.id,
      title: m.title,
      content: m.content,
      scope: m.scope,
      category: m.category,
      authorName: m.user?.name ?? null,
      updatedAt: m.updatedAt.toISOString(),
    };
    if (m.scope === "team") team.push(row);
    else personal.push(row);
  }
  return { personal, team, counts: { personal: personal.length, team: team.length } };
}

export async function getSkillById(userId: string, skillId: string) {
  return prisma.syntraAiSkill.findFirst({
    where: {
      id: skillId,
      active: true,
      OR: [{ scope: "team" }, { scope: "personal", userId }],
    },
    select: { id: true, name: true, description: true, body: true, scope: true },
  });
}
