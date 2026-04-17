from fastapi import FastAPI

from backend.core.database import Base, engine

from backend.router.route_produto import router as route_produto
from backend.router.router_auth  import router as route_auth

# IMPORTAR MODELS (importante para criar tabelas)
from backend.models.produto_model import Produto
from backend.models.empresa_model import Empresa
from backend.models.usuario_model import Usuario


app = FastAPI()

# registrar rotas
app.include_router(route_produto)
app.include_router(route_auth)


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)