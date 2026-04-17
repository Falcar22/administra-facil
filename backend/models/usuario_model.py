from sqlalchemy import Column, Integer, String, ForeignKey
from backend.core.database import Base


class Usuario(Base):

    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True)
    senha = Column(String)

    empresa_id = Column(Integer, ForeignKey("empresas.id"))