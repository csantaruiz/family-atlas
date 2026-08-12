-- Seed the Santa Ruiz Family Atlas with a stable UUID.
-- Set ATLAS_ID=8f3a2c1e-9b4d-4e6f-a1c2-d3e4f5a6b7c8 in Vercel and .env.local

INSERT INTO atlases (id, slug, name)
VALUES (
  '8f3a2c1e-9b4d-4e6f-a1c2-d3e4f5a6b7c8',
  'santa-ruiz',
  'Santa Ruiz Family Atlas'
)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name;
