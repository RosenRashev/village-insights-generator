CREATE TABLE public.report_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ekatte integer NOT NULL,
  category_id text NOT NULL,
  data jsonb NOT NULL,
  source_links jsonb,
  incident_count integer,
  cached_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  UNIQUE (ekatte, category_id)
);

CREATE INDEX report_cache_lookup_idx ON public.report_cache (ekatte, category_id);

GRANT SELECT ON public.report_cache TO anon;
GRANT SELECT ON public.report_cache TO authenticated;
GRANT ALL ON public.report_cache TO service_role;

ALTER TABLE public.report_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Report cache is publicly readable"
ON public.report_cache
FOR SELECT
TO anon, authenticated
USING (true);