# Bliss — Wedding Planning App

A calm, opinionated wedding planning app that gives couples one clear next step at a time. Built as a full-stack monorepo with a web app, mobile app, and API.

## What it does

- **7-stage planning system** — guides couples from engagement to wedding day, unlocking each stage as key tasks are completed
- **Stress check-ins** — mood tracking with personalized responses and honest tips
- **Budget tracker** — category-based spending with DIY/vendor breakdowns and estimate ranges
- **Guest list** — RSVP tracking with per-guest status
- **Celebration moments** — milestone cards that surface when a stage is completed
- **Push notifications** — gentle reminders for upcoming tasks

## Stack

| Layer | Tech |
|-------|------|
| API | Fastify + Bun + PostgreSQL + Drizzle ORM |
| Web | Next.js 14 + Tailwind CSS |
| Mobile | Expo (React Native) + NativeWind |
| Auth | Clerk |
| Deployment | API → Railway, Web → Vercel |

## Monorepo Structure

```
apps/
  api/        Fastify REST API
  web/        Next.js web app
  mobile/     Expo React Native app
packages/
  types/      Shared TypeScript types
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.0
- PostgreSQL database
- [Clerk](https://clerk.com) account

### Install

```bash
bun install
```

### Environment Variables

**`apps/api/.env`**
```
DATABASE_URL=postgresql://user@localhost:5432/bliss_dev
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=...
PORT=3001
NODE_ENV=development
```

**`apps/web/.env.local`**
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**`apps/mobile/.env`**
```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_API_URL=http://<your-local-ip>:3001
```

### Database

```bash
cd apps/api
bun run db:generate
bun run db:migrate
bun run db:seed
```

### Run

```bash
# All apps
bun run dev

# API only
cd apps/api && bun run dev

# Web only
cd apps/web && bun run dev

# Mobile only
cd apps/mobile && npx expo start --clear
```

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/weddings` | Create wedding with onboarding answers |
| GET | `/me/wedding` | Get current user's wedding |
| GET | `/weddings/:id/dashboard` | Dashboard data (tasks, budget, stress) |
| GET | `/weddings/:id/stages` | All 7 stages with tasks |
| PATCH | `/tasks/:id` | Complete or update a task |
| GET/POST | `/weddings/:id/budget-items` | Budget tracking |
| GET/POST | `/weddings/:id/guests` | Guest list |
| POST | `/weddings/:id/stress-checkins` | Save check-in |
| GET | `/stress-checkins/response` | Get personalized stress response |
| GET | `/weddings/:id/celebrations` | Pending milestone cards |
| PATCH | `/celebrations/:id/dismiss` | Dismiss a celebration |
