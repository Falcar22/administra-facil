from fastapi import APIRouter
from backend.security.auth import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
async def login():

    token = create_access_token({"sub": "usuario_teste"})

    return {"access_token": token, "token_type": "bearer"}