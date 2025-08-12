# Hexcarb AI Command Center

## CI Smoke Tests

GitHub Actions runs smoke tests against the production deployment to verify that the service responds and that admin authentication works.

### Required Secrets

The workflow requires the following repository secrets:

- `ADMIN_EMAIL` – admin account email
- `ADMIN_PASS` – admin account password

### Endpoints Tested

The smoke tests call the following endpoints:

- `https://ai.hexcarb.in/secure/ping`
- `https://ai.hexcarb.in/auth/login`

