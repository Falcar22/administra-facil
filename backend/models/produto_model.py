from sqlalchemy import Column, Integer, String, Float, ForeignKey
from backend.core.database import Base


class Produto(Base):
    __tablename__ = "produtos"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    preco = Column(Float, nullable=False)

    empresa_id = Column(Integer, ForeignKey("empresas.id"))