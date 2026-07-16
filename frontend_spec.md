# AXIS Frontend API Spec

Base URL: `VITE_API_URL` (default `http://localhost:8000`)

## Auth

| Method | Path | Body |
|--------|------|------|
| POST | `/api/auth/verify` | `{ did_token }` |
| POST | `/api/auth/register` | `{ did_token, ua_address?, sra_address? }` |

## Agent

| Method | Path | Body |
|--------|------|------|
| POST | `/api/agent/activate` | `{ user_id, budget_usdc, risk_level, goal, ua_address, sra_address? }` |
| POST | `/api/agent/rebalance` | `{ user_id, ua_address, instruction }` |
| GET | `/api/agent/status/{user_id}` | — |
| GET | `/api/agent/report/{user_id}` | — |

## Portfolio

| Method | Path |
|--------|------|
| GET | `/api/portfolio/positions/{user_id}` |
| GET | `/api/portfolio/yields/aave/{asset}` |
| GET | `/api/portfolio/yields/gmx` |

## Health

| Method | Path |
|--------|------|
| GET | `/health` |
| GET | `/config/status` |

## User flow

1. `/onboard` → Google login → set budget
2. Navigate to `/dashboard?activate=1&budget=500&risk=moderate&goal=...`
3. Dashboard calls `POST /api/agent/activate`
4. Poll `GET /api/agent/status/{user_id}` every 30s
5. Rebalance via `POST /api/agent/rebalance`
