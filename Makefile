.PHONY: help install test mock api ui check

help:
	@echo "make install   - python deps + node deps"
	@echo "make test      - run the rules engine tests"
	@echo "make mock      - API with NO model (works immediately)"
	@echo "make api       - API with the real model"
	@echo "make ui        - frontend dev server"
	@echo "make check     - pre-demo: tests + health endpoint"

install:
	pip install -r requirements.txt
	cd ui && npm install

test:
	python -m pytest

mock:
	MOCK_MODE=true uvicorn api.main:app --host 0.0.0.0 --port 8000

api:
	uvicorn api.main:app --host 0.0.0.0 --port 8000

ui:
	cd ui && npm run dev:https

check:
	python -m pytest
	@curl -sf localhost:8000/health && echo "\n✓ API healthy" || echo "\n✗ API not responding"
