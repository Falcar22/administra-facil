# 🚀 Administra-Fácil (Girofy Core)

O **Administra-Fácil** é uma API robusta desenvolvida para gestão empresarial multi-empresa,
focada em automação de processos, controle de estoque e PDV (Ponto de Venda). 
Este projeto é o "coração" (core) de um ecossistema focado em simplificar a administração de pequenos e médios negócios.

## ✨ Funcionalidades Principais
* **Arquitetura Multi-tenant:** Preparado para isolamento de dados entre diferentes empresas.
* **Gestão de Produtos:** CRUD completo com serviços assíncronos.
* **Autenticação JWT:** Segurança baseada em tokens para proteção de rotas.
* **Base de Dados:** Integração com SQLAlchemy para suporte a múltiplos bancos.

## 🛠️ Tecnologias Utilizadas
* **Python 3.10+**
* **FastAPI:** Framework web de alta performance.
* **SQLAlchemy:** ORM para manipulação de dados.
* **Uvicorn:** Servidor ASGI para rodar a aplicação.

## 🚀 Como Rodar o Projeto Localmente

1. **Clone o repositório:**
   ```bash
   git clone [https://github.com/Falcar22/administra-facil.git](https://github.com/Falcar22/administra-facil.git)
   Crie um ambiente virtual e ative-o:

Bash
python -m venv .venv
.venv\Scripts\activate
Instale as dependências:

Bash
pip install -r requirements.txt
Inicie o servidor:

Bash
uvicorn backend.main:app --reload
Acesse a documentação interativa (Swagger):
Abra o navegador em: http://127.0.0.1:8000/docs

Desenvolvido por Fábio Cardoso – Especialista em Automação e TI.
