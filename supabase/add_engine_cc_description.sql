-- Adds the two columns the parser now writes (engine_cc, description) to the
-- `cars` table. APPLY THIS IN SUPABASE *BEFORE* deploying the updated parser —
-- otherwise the upsert in parser-main/parsers/db.py fails on the unknown column
-- and cars stop saving.
--
-- Safe to run repeatedly (IF NOT EXISTS).

ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS engine_cc   integer,   -- exact displacement in cm³
  ADD COLUMN IF NOT EXISTS description text;       -- seller's free-text description

-- Optional: index for numeric engine-volume range filtering in the catalog.
CREATE INDEX IF NOT EXISTS cars_engine_cc_idx ON public.cars (engine_cc);
