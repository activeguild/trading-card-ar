.PHONY: setup dev backend frontend

setup:
	cd backend && pip install -r requirements.txt
	cd frontend && pnpm install

dev:
	@$(MAKE) -j2 backend frontend

backend:
	cd backend && uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && pnpm dev
