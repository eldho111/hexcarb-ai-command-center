# Hexcarb AI Command Center

## Authentication

The Streamlit interface requires login. Set the environment variable
`HEXCARB_APP_PASSWORD` to the shared password. Users must sign in with an
email address that ends with `@hexcarb.in`.

### Running locally

```bash
export HEXCARB_APP_PASSWORD="your-secret-password"
streamlit run app.py
```

This will launch the password protected Hexcarb AI dashboard.

