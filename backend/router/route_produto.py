from backend.schemas.produto_schema import ProdutoCreate, ProdutoResponse

from fastapi import APIRouter, HTTPException, Query
from backend.services.produto_service import ProdutoService
from backend.schemas.produto_schema import ProdutoCreate, ProdutoResponse
from backend.security.deps import get_current_user
from fastapi import Depends


router = APIRouter(prefix="/produtos", tags=["Produtos"])


@router.get("/")
async def listar_produtos(user=Depends(get_current_user)):
    return await ProdutoService.listar()

    return await ProdutoService.listar(
        empresa_id,
        skip,
        limit,
        nome,
        preco_min,
        preco_max
    )

@router.get("/produtos")
async def listar_produtos(user=Depends(get_current_user)):

    empresa_id = user["empresa_id"]

    return await ProdutoService.listar(empresa_id)


@router.post("/", response_model=ProdutoResponse)
async def criar(produto: ProdutoCreate):
    return await ProdutoService.criar(produto)


@router.put("/{produto_id}", response_model=ProdutoResponse)
async def atualizar(produto_id: int, produto: ProdutoCreate):
    atualizado = await ProdutoService.atualizar(produto_id, produto)
    if not atualizado:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return atualizado


@router.delete("/{produto_id}")
async def deletar(produto_id: int):
    deletado = await ProdutoService.deletar(produto_id)
    if not deletado:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return {"message": "Produto deletado com sucesso"}