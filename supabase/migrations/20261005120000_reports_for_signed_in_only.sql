-- Докладите се виждат само от влезли потребители (с акаунт).
-- Пусни след като новата версия на приложението е в production (иначе гостите ще получават грешка).

-- Публичните доклади — само за влезли потребители (вече не за анонимни).
DROP POLICY IF EXISTS "Public reports readable by anyone" ON public.reports;
CREATE POLICY "Public reports readable by signed-in users" ON public.reports
  FOR SELECT TO authenticated USING (is_public);
REVOKE SELECT ON public.reports FROM anon;

-- Кешът на проучванията се чете само от сървъра (със service role, който пренебрегва RLS);
-- клиентът няма нужда от достъп, затова се затваря за всички.
DROP POLICY IF EXISTS "Report cache is publicly readable" ON public.report_cache;
REVOKE SELECT ON public.report_cache FROM anon, authenticated;
