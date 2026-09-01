-- Asistente Syntra IA (port desde Odoo syntra_ai_assistant)

CREATE TABLE IF NOT EXISTS "syntra_ai_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL DEFAULT 'opencode_go',
    "baseUrl" TEXT,
    "apiKey" TEXT,
    "model" TEXT NOT NULL DEFAULT 'kimi-k2.7-code',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "syntra_ai_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "syntra_ai_settings" ("id", "enabled", "provider", "model", "updatedAt")
VALUES ('default', false, 'opencode_go', 'kimi-k2.7-code', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "syntra_ai_memories" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'personal',
    "category" TEXT NOT NULL DEFAULT 'other',
    "userId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "syntra_ai_memories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "syntra_ai_memories_scope_active_idx" ON "syntra_ai_memories"("scope", "active");
CREATE INDEX IF NOT EXISTS "syntra_ai_memories_userId_idx" ON "syntra_ai_memories"("userId");

ALTER TABLE "syntra_ai_memories"
    ADD CONSTRAINT "syntra_ai_memories_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "syntra_ai_skills" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'team',
    "userId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "syntra_ai_skills_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "syntra_ai_skills_name_scope_userId_key"
    ON "syntra_ai_skills"("name", "scope", "userId");
CREATE INDEX IF NOT EXISTS "syntra_ai_skills_scope_active_idx" ON "syntra_ai_skills"("scope", "active");

ALTER TABLE "syntra_ai_skills"
    ADD CONSTRAINT "syntra_ai_skills_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "syntra_ai_chat_sessions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Nueva conversación',
    "userId" TEXT NOT NULL,
    "pagePath" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "syntra_ai_chat_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "syntra_ai_chat_sessions_userId_updatedAt_idx"
    ON "syntra_ai_chat_sessions"("userId", "updatedAt");

ALTER TABLE "syntra_ai_chat_sessions"
    ADD CONSTRAINT "syntra_ai_chat_sessions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "syntra_ai_chat_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "syntra_ai_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "syntra_ai_chat_messages_sessionId_sequence_idx"
    ON "syntra_ai_chat_messages"("sessionId", "sequence");

ALTER TABLE "syntra_ai_chat_messages"
    ADD CONSTRAINT "syntra_ai_chat_messages_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "syntra_ai_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
