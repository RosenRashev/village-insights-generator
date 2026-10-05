-- Лична информация към доклад (настояща локация, цел на търсенето, разстояние от локацията).
-- Вижда се САМО от автора. Докладът в `reports` е винаги „чист“ — без лична информация —
-- затова публикуването му не разкрива нищо за автора.
--
-- Пусни ПРЕДИ или веднага след деплоя на новата версия. Без таблицата приложението работи,
-- но не помни личните данни на автора (локация/цел) след запис.

CREATE TABLE IF NOT EXISTS public.report_personal (
  report_id uuid PRIMARY KEY REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_personal_user_id_idx ON public.report_personal (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_personal TO authenticated;
GRANT ALL ON public.report_personal TO service_role;
REVOKE ALL ON public.report_personal FROM anon;

ALTER TABLE public.report_personal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage own report personal data" ON public.report_personal;
CREATE POLICY "Owners manage own report personal data" ON public.report_personal
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.user_id = auth.uid())
  );
