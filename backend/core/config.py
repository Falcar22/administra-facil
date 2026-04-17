from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    MONGO_URI: str = "mongodb://mongodb:27017"
    DATABASE_NAME: str = "gestao_db"

settings = Settings()