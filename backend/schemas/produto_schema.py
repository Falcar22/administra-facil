from pydantic import BaseModel, Field, field_validator


class ProdutoBase(BaseModel):
    nome: str = Field(..., min_length=2, max_length=100)
    preco: float = Field(..., gt=0)

    @field_validator("nome")
    @classmethod
    def nome_nao_vazio(cls, value):
        if not value.strip():
            raise ValueError("O nome não pode ser vazio")
        return value


class ProdutoCreate(ProdutoBase):
    pass


class ProdutoResponse(ProdutoBase):
    id: int

    class Config:
        from_attributes = True