from sqlalchemy import select
from backend.models.produto_model import Produto
from backend.core.database import async_session


from sqlalchemy import select, func
from backend.models.produto_model import Produto
from backend.core.database import async_session


class ProdutoRepository:

    @staticmethod
    async def listar(empresa_id, skip=0, limit=10, nome=None, preco_min=None, preco_max=None):

        async with async_session() as session:

            query = select(Produto).where(Produto.empresa_id == empresa_id)

            if nome:
                query = query.where(Produto.nome.ilike(f"%{nome}%"))

            if preco_min:
                query = query.where(Produto.preco >= preco_min)

            if preco_max:
                query = query.where(Produto.preco <= preco_max)

            # contar total
            total_query = select(func.count()).select_from(query.subquery())
            total_result = await session.execute(total_query)
            total = total_result.scalar()

            query = query.offset(skip).limit(limit)

            result = await session.execute(query)
            produtos = result.scalars().all()

            return {
                "data": produtos,
                "total": total,
                "skip": skip,
                "limit": limit
            }
    @staticmethod
    async def buscar_por_id(produto_id: int):
        async with async_session() as session:
            result = await session.execute(
                select(Produto).where(Produto.id == produto_id)
            )
            return result.scalar_one_or_none()

    @staticmethod
    async def criar(dados: dict):
        async with async_session() as session:
            produto = Produto(**dados)
            session.add(produto)
            await session.commit()
            await session.refresh(produto)
            return produto

    @staticmethod
    async def atualizar(produto_id: int, dados: dict):
        async with async_session() as session:
            result = await session.execute(
                select(Produto).where(Produto.id == produto_id)
            )
            produto = result.scalar_one_or_none()

            if not produto:
                return None

            for key, value in dados.items():
                setattr(produto, key, value)

            await session.commit()
            await session.refresh(produto)
            return produto

    @staticmethod
    async def deletar(produto_id: int):
        async with async_session() as session:
            result = await session.execute(
                select(Produto).where(Produto.id == produto_id)
            )
            produto = result.scalar_one_or_none()

            if not produto:
                return False

            await session.delete(produto)
            await session.commit()
            return True