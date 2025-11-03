# Ops Platform Frontend

React + Vite single-page application that powers the Ops Platform user experience for bidders, profile makers, mail checkers, callers, and supporting teams.

## Tech Stack
- React 18 with React Router for routing
- Vite for bundling and dev server
- Tailwind CSS for styling
- Day.js utilities for date handling

## Prerequisites
- Node.js 18 or newer

## Setup
```bash
npm install
```

Create a `.env` file when you need to override the default API endpoint:
```bash
VITE_API_URL=http://localhost:4000/api
```
If not provided, the client falls back to `http://localhost:4000/api`.

## Development
```bash
npm run dev
```
The dev server runs on `http://localhost:5173`. Make sure the backend server is running so authenticated flows work end-to-end.

## Production Build
```bash
npm run build
npm run preview
```

## Project Layout
```
src/
  api/          API client wrapper
  components/   Shared UI components
  pages/        Application routes
  state/        Store and auth/session helpers
```

## Environment Notes
- The client expects JWT-based auth headers from the backend.
- Update the `CLIENT_ORIGIN` value in the backend `.env` when deploying the frontend to a different host.
