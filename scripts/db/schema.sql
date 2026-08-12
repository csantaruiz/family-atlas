-- Family Atlas media foundation: Atlas → Person → Media
-- Person rows are NOT mirrored here; person_id is the GEDCOM id string.

CREATE TABLE IF NOT EXISTS atlases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atlas_id UUID NOT NULL REFERENCES atlases (id) ON DELETE CASCADE,
  person_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('portrait', 'photo', 'document')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  blob_pathname TEXT NOT NULL UNIQUE,
  blob_url TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER,
  width INTEGER,
  height INTEGER,
  original_filename TEXT,
  caption TEXT,
  credit TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_assets_atlas_person_idx
  ON media_assets (atlas_id, person_id);

CREATE INDEX IF NOT EXISTS media_assets_atlas_kind_idx
  ON media_assets (atlas_id, kind);

CREATE UNIQUE INDEX IF NOT EXISTS media_assets_one_primary_portrait
  ON media_assets (atlas_id, person_id)
  WHERE kind = 'portrait' AND is_primary = true;
