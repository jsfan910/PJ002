-- 001_create_todos.sql
-- P0：待辦事項主表。對應 SA §3.1 Todo 實體。

-- gen_random_uuid() 自 PostgreSQL 13 起為內建函式，不需 CREATE EXTENSION pgcrypto。
CREATE TABLE IF NOT EXISTS todos (
    id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    title         varchar(200) NOT NULL,
    is_completed  boolean      NOT NULL DEFAULT false,
    created_at    timestamptz  NOT NULL DEFAULT now(),
    updated_at    timestamptz  NOT NULL DEFAULT now(),
    owner_id      uuid         NULL,           -- P0 恆為 NULL；P1 於 002 改為 NOT NULL + FK

    -- BR-001 / BR-002 / 不變量 I-1：去除前後空白後長度必須在 1..200。
    -- 用 btrim 而非直接比長度，否則 '   ' 這種全空白字串會通過檢查。
    CONSTRAINT todos_title_not_blank
        CHECK (char_length(btrim(title)) BETWEEN 1 AND 200)
);

-- BR-005 清單排序（建立時間由新到舊）+ id 作為 tie-break，使順序為決定性。
CREATE INDEX IF NOT EXISTS idx_todos_created_at_desc
    ON todos (created_at DESC, id DESC);

-- BR-003 / 不變量 I-2：created_at 一經寫入不再改變。
-- 應用層已不送 created_at，此觸發器是第二道防線（防手動 SQL 或未來的程式碼疏漏）。
-- 同時自動維護 updated_at，應用層不需關心。
CREATE OR REPLACE FUNCTION todos_protect_created_at()
RETURNS trigger AS $$
BEGIN
    NEW.created_at := OLD.created_at;   -- 強制還原，任何改動嘗試都靜默失效
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_todos_protect_created_at ON todos;
CREATE TRIGGER trg_todos_protect_created_at
    BEFORE UPDATE ON todos
    FOR EACH ROW EXECUTE FUNCTION todos_protect_created_at();
