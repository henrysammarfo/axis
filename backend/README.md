# AXIS Backend

FastAPI backend for the AXIS AI DeFi portfolio agent.

## Quick start

```bash
cp .env.example .env
# Add your API keys to .env
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Or from repo root:
```bash
./scripts/start-backend.sh
```

Or with Docker:
```bash
docker compose up --build
```

## Tests

```bash
python3 -m pytest tests/ -v
```

## API docs

- Swagger: http://localhost:8000/docs
- Health: http://localhost:8000/health
- Config status: http://localhost:8000/config/status

## Keys

See `../docs/KEYS_SETUP.md` for full setup instructions.
