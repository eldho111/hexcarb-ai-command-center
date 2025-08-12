from fastapi import FastAPI
from modules.accounting.routes import router as accounting_router

app = FastAPI()

app.include_router(accounting_router, prefix="/api/accounting", tags=["accounting"])
