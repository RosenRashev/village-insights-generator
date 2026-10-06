-- Версия на промпта, с който е генерирана кешираната категория.
-- Кеш с друга (или липсваща) версия се счита за остарял и се генерира наново.
alter table public.report_cache add column if not exists prompt_version text;
