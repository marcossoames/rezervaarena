# RezervăArena

Platformă de rezervări online pentru terenuri sportive din România.

## Tehnologii

- React + TypeScript
- Vite
- Tailwind CSS
- Supabase (autentificare, bază de date, edge functions)
- Capacitor (iOS)

## Instalare

```sh
git clone <repo-url>
cd rezervaarena
npm install
npm run dev
```

## Build

```sh
npm run build
```

## Deploy

Aplicația se poate deploya pe orice platformă care suportă aplicații statice (Vercel, Netlify, Cloudflare Pages etc.).

## Structură

- `src/` — cod sursă React
- `supabase/` — edge functions și configurare Supabase
- `ios/` — proiect nativ iOS (Capacitor)
- `public/` — asset-uri statice
