PROJECT := $(shell gcloud config get-value project)
REGION  := asia-southeast1

API_SVC := hexcarb-api
UI_SVC  := hexcarb-ui

API_IMG := gcr.io/$(PROJECT)/$(API_SVC)
UI_IMG  := gcr.io/$(PROJECT)/$(UI_SVC)

.PHONY: help build-api deploy-api url-api build-ui deploy-ui url-ui set-ui-env logs-api logs-ui

help:
	@echo "Targets:"
	@echo "  make build-api     - Build API image"
	@echo "  make deploy-api    - Deploy API to Cloud Run"
	@echo "  make url-api       - Print API URL"
	@echo "  make build-ui      - Build UI image"
	@echo "  make deploy-ui     - Deploy UI to Cloud Run"
	@echo "  make url-ui        - Print UI URL"
	@echo "  make set-ui-env    - Set API_BASE_URL on UI to point at API"
	@echo "  make logs-api      - Show recent API logs"
	@echo "  make logs-ui       - Show recent UI logs"

build-api:
	cp -f Dockerfile.api Dockerfile
	gcloud builds submit --tag $(API_IMG) .
	rm -f Dockerfile

deploy-api:
	gcloud run deploy $(API_SVC) --image $(API_IMG) --allow-unauthenticated --region $(REGION) --platform managed

url-api:
	@echo API_URL=$$(gcloud run services describe $(API_SVC) --format='value(status.url)' --region $(REGION) --platform managed)

build-ui:
	cp -f Dockerfile.ui Dockerfile
	gcloud builds submit --tag $(UI_IMG) .
	rm -f Dockerfile

deploy-ui:
	gcloud run deploy $(UI_SVC) --image $(UI_IMG) --allow-unauthenticated --region $(REGION) --platform managed

url-ui:
	@echo UI_URL=$$(gcloud run services describe $(UI_SVC) --format='value(status.url)' --region $(REGION) --platform managed)

set-ui-env:
	$(eval API_URL := $(shell gcloud run services describe $(API_SVC) --format='value(status.url)' --region $(REGION) --platform managed))
	gcloud run services update $(UI_SVC) --set-env-vars API_BASE_URL=$(API_URL),APP_NAME="HEXCARB AI Engine" --region $(REGION) --platform managed
	@echo "API_BASE_URL set to: $(API_URL)"

logs-api:
	@REV=$$(gcloud run services describe $(API_SVC) --format='value(status.latestCreatedRevisionName)' --region $(REGION) --platform managed); \
	gcloud logging read "resource.type=cloud_run_revision AND resource.labels.revision_name=$$REV" --limit=50 --format='value(textPayload)'

logs-ui:
	@REV=$$(gcloud run services describe $(UI_SVC) --format='value(status.latestCreatedRevisionName)' --region $(REGION) --platform managed); \
	gcloud logging read "resource.type=cloud_run_revision AND resource.labels.revision_name=$$REV" --limit=50 --format='value(textPayload)'
