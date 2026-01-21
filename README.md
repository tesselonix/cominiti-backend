# Cominiti Backend API

This is the backend API server for Cominiti, providing API endpoints for the frontend application.

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Development

Start the development server on port 3001:

```bash
npm run dev -- -p 3001
```

The API will be available at `http://localhost:3001`.

### Build

```bash
npm run build
```

### Production

```bash
npm run start -- -p 3001
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/ai/*` | AI services (contract generator, email generator, rate estimator) |
| `/api/brands/*` | Brand management |
| `/api/creators/*` | Creator management |
| `/api/generate-portfolio` | Portfolio generation |
| `/api/instagram/*` | Instagram integration |
| `/api/orders/*` | Order management |

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
# Add other required environment variables
```

## Architecture

This backend is a Next.js API-only server. Frontend pages are served from the separate `frontend` project.

### CORS Configuration

CORS is configured to accept requests from the frontend (default: `http://localhost:3000`). Update `FRONTEND_URL` environment variable for production.
# cominiti-backend
