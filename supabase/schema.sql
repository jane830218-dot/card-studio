-- 圖卡自動化系統 — Supabase 資料表結構
-- 用途：讓使用者在網站上把填好的欄位內容存成「草稿」，之後可以再叫出來繼續編輯。
-- 正式的圖卡輸出（透明底 PNG）本身不需要存進資料庫，使用者自行下載即可；
-- 這裡只存「欄位內容 + 選用哪個版型」，之後打開網站就能重建畫面。

create extension if not exists "pgcrypto";

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_id text not null,
  field_values jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cards_updated_at_idx on public.cards (updated_at desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists cards_set_updated_at on public.cards;
create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

-- Row Level Security：
-- ⚠️ MVP 先開放給「任何拿到 anon key 的人」讀寫全部草稿（因為網站目前還沒做登入功能），
-- 這樣設定只適合內部團隊、網址不公開的情況。等之後加上 Supabase Auth 登入流程，
-- 務必把下面四條政策的 to anon 拿掉、改成 to authenticated，
-- 並視需要把 using(true) 收緊成 created_by = auth.uid()，避免任何人都能看到/刪除所有草稿。
alter table public.cards enable row level security;

drop policy if exists "cards_select_anon" on public.cards;
create policy "cards_select_anon"
  on public.cards for select
  to anon, authenticated
  using (true);

drop policy if exists "cards_insert_anon" on public.cards;
create policy "cards_insert_anon"
  on public.cards for insert
  to anon, authenticated
  with check (true);

drop policy if exists "cards_update_anon" on public.cards;
create policy "cards_update_anon"
  on public.cards for update
  to anon, authenticated
  using (true);

drop policy if exists "cards_delete_anon" on public.cards;
create policy "cards_delete_anon"
  on public.cards for delete
  to anon, authenticated
  using (true);
