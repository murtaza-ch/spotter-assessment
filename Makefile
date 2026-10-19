.PHONY: setup dev check test e2e format api

setup:
	npm run setup

dev:
	npm run dev

check:
	npm run check

test:
	npm test

e2e:
	npm run test:e2e

format:
	npm run format

api:
	npm run api:generate
