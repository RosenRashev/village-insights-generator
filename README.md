# Къде Да

Уеб приложение за проучване на български села и малки градове — инфраструктура, ВиК, транспорт,
сигурност, демография, услуги и др. — преди покупка на имот или преместване. Докладите се
генерират от Gemini (със Google Search) и се визуализират като инфографика.

**Сайт:** https://kadeda.eu

## Стек
- TanStack Start (React 19, Vite, Nitro), Tailwind CSS 4, shadcn/ui
- Supabase (PostgreSQL, Auth) — самостоятелен проект
- Google Gemini API (`src/lib/report-generator.server.ts`)
- Хостинг: Vercel (автоматичен деплой от `main`)

## Локална разработка
```bash
bun install
bun run dev
```

Нужни променливи на средата (във Vercel — и двата варианта на първите две):
`SUPABASE_URL` / `VITE_SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` (само сървър), `GEMINI_API_KEY`.
В репото няма `.env` файл и не трябва да се добавя.

## Структура
- `src/lib/prompt-modules.ts` — категориите на доклада и инструкциите към Gemini
- `src/lib/report-generator.server.ts` — проучване + структуриране (две стъпки)
- `src/lib/report-cache*.ts` — споделен кеш по ЕКАТТЕ и категория
- `src/components/ReportInfographic.tsx`, `src/lib/report-layout.ts` — визуализация
- `src/lib/plans.ts` — лимити и платени функции (единственото място за промяна)
- `src/lib/report-privacy.ts` — премахване на личните данни от публичните доклади
- `docs/TODO.md` — идеи и планирани функции
