# Cloud media (private Blob + Neon)

This Atlas stores user-uploaded portraits in **Vercel Blob** (private) with metadata in **Neon Postgres**.

## One-time setup

1. Ensure `.env.local` has `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, and `ATLAS_EDIT_SECRET`.
2. Run:

```bash
npm install
npm run db:migrate
npm run db:seed
```

3. Confirm `.env.local` now includes `ATLAS_ID=8f3a2c1e-9b4d-4e6f-a1c2-d3e4f5a6b7c8`.
4. Add the same `ATLAS_ID` in the Vercel project Environment Variables.

## Local development (API + app)

`/api/*` only works when Vercel serves the app. Use:

```bash
npm run dev:vercel
```

That runs `vercel dev` on **http://localhost:3000** (it will also start Vite internally).

Do **not** use plain `npm run dev` (Vite only) for upload testing — it cannot serve API routes (you'll get 404 on unlock).

Quick check: open http://localhost:3000/api/health — you should see JSON with `"ok": true`.

## Privacy model

- Blob objects are **private**
- Images are served only via `GET /api/media/:assetId` (authenticated delivery by atlas scope)
- Mutations require the edit cookie from `POST /api/auth/unlock`
