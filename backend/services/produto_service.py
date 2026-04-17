from backend.repositories.produto_repository import ProdutoRepository

class ProdutoService:

    @staticmethod
    async def listar(empresa_id, skip=0, limit=10, nome=None, preco_min=None, preco_max=None):
        return await ProdutoRepository.listar(
            empresa_id,
            skip,
            limit,
            nome,
            preco_min,
            preco_max
        )
    @staticmethod
    async def buscar_por_id(produto_id: int):
        return await ProdutoRepository.buscar_por_id(produto_id)

    @staticmethod
    async def criar(produto):
        return await ProdutoRepository.criar(produto.dict())

    @staticmethod
    async def atualizar(produto_id: int, produto):
        return await ProdutoRepository.atualizar(produto_id, produto.dict())

    @staticmethod
    async def deletar(produto_id: int):
        return await ProdutoRepository.deletar(produto_id)