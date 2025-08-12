# Hexcarb AI Command Center

## Environment Variables

- `SECRET_KEY`: a strong random value.
- `COOKIE_SECURE`: set to `true` to enforce secure cookies.
- `ALLOWED_ORIGINS`: comma-separated list including `https://hexcarb.in` and `https://ai.hexcarb.in`.

## Heroku Setup

- `heroku login`
- `heroku create hexcarb-ai-command-center` (or use existing app)
- `heroku addons:create heroku-postgresql:mini`
- `heroku config:set SECRET_KEY=<strong_random> COOKIE_SECURE=true ALLOWED_ORIGINS=https://hexcarb.in,https://ai.hexcarb.in`
- `git push heroku HEAD:main`
- `heroku run python -m scripts.init_db`

