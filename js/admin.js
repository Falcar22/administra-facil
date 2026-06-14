// js/admin.js
// Garante que o script use o cliente global do Supabase que está ativo no projeto
const _supabase = window.supabaseClient;

// Execução Inicial e Proteção de Rota
if (localStorage.getItem('admin_autenticado') !== 'true') {
    window.location.href = 'index.html';
} else {
    // Carrega o faturamento assim que a página abre
    document.addEventListener("DOMContentLoaded", () => {
        carregarDashboard();
    });
}

/**
 * 1. CARREGA AS MÉTRICAS DE DINHEIRO E HISTÓRICO
 */
async function carregarDashboard() {
    console.log("📊 Buscando dados das vendas...");

    try {
        const { data: vendas, error: errVendas } = await _supabase
            .from('vendas')
            .select('*'); 

        if (errVendas) {
            console.error("❌ Erro Supabase:", errVendas.message);
            return;
        }

        console.log("🛒 Vendas recuperadas:", vendas);

        // Cálculos com base na coluna 'total' do seu banco
        const totalVendido = vendas.reduce((acc, v) => acc + (Number(v.total) || 0), 0);
        
        // Simulação de despesas (Caso tenha uma tabela de despesas futura, mude aqui)
        const totalDespesas = 0.00; 
        const saldoLiquido = totalVendido - totalDespesas;

        // Atualizar os novos cards premium na tela
        if (document.getElementById('faturamento-real')) {
            document.getElementById('faturamento-real').innerText = totalVendido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
        if (document.getElementById('despesas-real')) {
            document.getElementById('despesas-real').innerText = totalDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
        if (document.getElementById('saldo-real')) {
            document.getElementById('saldo-real').innerText = saldoLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }

        // Deixa o painel dinâmico pronto mostrando o histórico por padrão
        atualizarTabelaVendas(vendas);

    } catch (error) {
        console.error("❌ Erro no Dashboard:", error);
    }
}

/**
 * 2. HISTÓRICO DE TRANSAÇÕES (Injetado dentro da área dinâmica)
 */
function atualizarTabelaVendas(vendas) {
    const painelDinamico = document.getElementById('painel-dinamico-admin');
    if (!painelDinamico) return;

    painelDinamico.classList.remove('hidden');

    if (!vendas || vendas.length === 0) {
        painelDinamico.innerHTML = `
            <h3 class="text-base font-bold text-amber-300 mb-4">🧾 Últimas Transações do Caixa</h3>
            <div class="text-center py-6 text-slate-500 italic text-sm">Nenhuma venda realizada hoje.</div>
        `;
        return;
    }

    let htmlHistorico = `
        <h3 class="text-base font-bold text-amber-300 mb-4 flex items-center gap-2">
            <span>🧾</span> Últimas Transações do Caixa
        </h3>
        <div class="overflow-x-auto">
            <table class="w-full text-left text-sm border-collapse">
                <thead>
                    <tr class="border-b border-slate-800 text-slate-400 text-xs uppercase font-bold">
                        <th class="py-3 px-2">Data/Hora</th>
                        <th class="py-3 px-2">Descrição</th>
                        <th class="py-3 px-2">Operador</th>
                        <th class="py-3 px-2 text-right">Valor</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/50 text-slate-300">
    `;

    // Renderiza as linhas invertidas (vendas mais recentes primeiro)
    vendas.slice().reverse().forEach(v => {
        const data = v.created_at ? new Date(v.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '---';
        const formaPgto = v.forma_pagamento || 'PIX';
        const operador = v.operador || 'Sistema';
        const valor = (Number(v.total) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        htmlHistorico += `
            <tr class="hover:bg-slate-800/30 transition-colors">
                <td class="py-3 px-2 text-slate-400 font-mono">${data}</td>
                <td class="py-3 px-2 font-medium">Venda Realizada (${formaPgto})</td>
                <td class="py-3 px-2 text-slate-400">${operador}</td>
                <td class="py-3 px-2 text-right font-bold text-emerald-400">${valor}</td>
            </tr>
        `;
    });

    htmlHistorico += `
                </tbody>
            </table>
        </div>
    `;

    painelDinamico.innerHTML = htmlHistorico;
}

/**
 * 3. CONTROLADOR DO ESTOQUE REAL (Semáforo Dinâmico conectado ao Supabase)
 */
window.carregarEstoqueReal = async function() {
    console.log("📦 Carregando dados de estoque reais do Supabase...");
    const painelDinamico = document.getElementById('painel-dinamico-admin');
    if (!painelDinamico) return;

    // Mostra o container com efeito visual de loading
    painelDinamico.classList.remove('hidden');
    painelDinamico.innerHTML = `<div class="text-center py-6 text-slate-400 animate-pulse">Buscando estoque no banco de dados...</div>`;

    try {
        // Busca os produtos direto da tabela real do seu Supabase
        const { data: produtos, error } = await _supabase
            .from('produtos')
            .select('*');

        if (error) {
            painelDinamico.innerHTML = `<div class="text-rose-400 p-2">Erro ao ler estoque: ${error.message}</div>`;
            return;
        }

        if (!produtos || produtos.length === 0) {
            painelDinamico.innerHTML = `
                <h3 class="text-base font-bold text-amber-300 mb-4">📦 Situação do Estoque</h3>
                <div class="text-center py-6 text-slate-500 italic text-sm">Nenhum produto cadastrado no banco.</div>
            `;
            return;
        }

        let htmlEstoque = `
            <h3 class="text-base font-bold text-amber-300 mb-4 flex items-center gap-2">
                <span>📦</span> Situação do Estoque de Produtos
            </h3>
            <div class="space-y-3">
        `;

        produtos.forEach(item => {
            const quantidade = Number(item.quantidade) || Number(item.qtd) || 0;
            const nome = item.nome || item.nome_produto || "Produto Sem Nome";

            // LÓGICA DO SEMÁFORO INTELIGENTE:
            let iconeSinal = "🟢";
            let corStatus = "emerald";
            let legenda = "Estoque Seguro";

            if (quantidade <= 0) {
                iconeSinal = "🔴";
                corStatus = "rose";
                legenda = "Estoque Esgotado!";
            } else if (quantidade <= 5) {
                iconeSinal = "🟡";
                corStatus = "amber";
                legenda = "Estoque Crítico (Comprar)";
            }

            htmlEstoque += `
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-slate-800/30 border border-slate-700/40 rounded-xl gap-3">
                    <div class="flex items-center gap-3">
                        <span class="text-xl">${iconeSinal}</span>
                        <div>
                            <span class="font-bold text-sm block text-slate-200">${nome.toUpperCase()}</span>
                            <span class="text-[11px] text-slate-400">Status: <b class="text-${corStatus}-400">${legenda}</b></span>
                        </div>
                    </div>

                    <div class="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                        <div class="text-right sm:mr-4">
                            <span class="text-[10px] text-slate-400 block uppercase font-bold">Quantidade</span>
                            <span class="text-lg font-black text-slate-100">${quantidade} UN</span>
                        </div>
                        
                        <div class="flex items-center gap-1.5">
                            <button onclick="window.ajustarEstoqueRapido(${item.id}, -1)" class="bg-rose-950/50 hover:bg-rose-900 border border-rose-800/60 text-rose-200 w-10 h-10 rounded-lg text-lg font-black transition active:scale-95 flex items-center justify-center cursor-pointer">
                                -
                            </button>
                            <button onclick="window.ajustarEstoqueRapido(${item.id}, 1)" class="bg-emerald-950/50 hover:bg-emerald-900 border border-emerald-800/60 text-emerald-200 w-10 h-10 rounded-lg text-lg font-black transition active:scale-95 flex items-center justify-center cursor-pointer">
                                +
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        htmlEstoque += `</div>`;
        painelDinamico.innerHTML = htmlEstoque;

    } catch (err) {
        console.error("Erro técnico no estoque:", err);
        painelDinamico.innerHTML = `<div class="text-rose-400 p-2">Erro crítico no servidor de estoque.</div>`;
    }
};

/**
 * 4. ATUALIZADOR RÁPIDO DE QUANTIDADE DO ESTOQUE NO BANCO (+ e -)
 */
window.ajustarEstoqueRapido = async function(idProduto, variacao) {
    try {
        // 1. Pega a quantidade atual direto do banco para evitar conflito
        const { data: item, error: fetchErr } = await _supabase
            .from('produtos')
            .select('quantidade')
            .eq('id', idProduto)
            .single();

        if (fetchErr) return;

        const novaQtd = Math.max(0, (Number(item.quantidade) || 0) + variacao);

        // 2. Grava o novo valor no Supabase
        const { error: updateErr } = await _supabase
            .from('produtos')
            .update({ quantidade: novaQtd })
            .eq('id', idProduto);

        if (updateErr) {
            alert("Erro ao atualizar o estoque: " + updateErr.message);
            return;
        }

        // 3. Recarrega a interface do estoque atualizada
        window.carregarEstoqueReal();

    } catch (err) {
        console.error("Erro ao alterar quantidade:", err);
    }
};

// Função de Logout
window.logout = function() {
    localStorage.removeItem('admin_autenticado');
    window.location.href = 'index.html';
};
// ====== CONTROLE DOS MODAIS ======

function abrirModalGasto() {
    const modal = document.getElementById('modal-gasto');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('gasto-descricao').focus();
    } else {
        console.error("Erro: Elemento 'modal-gasto' não foi encontrado no HTML.");
    }
}

function fecharModalGasto() {
    const modal = document.getElementById('modal-gasto');
    if (modal) {
        modal.classList.add('hidden');
        document.getElementById('form-gasto').reset();
    }
}
async function salvarGasto(event) {
    event.preventDefault();

    const descricao = document.getElementById('gasto-descricao').value.trim();
    const valorRaw = document.getElementById('gasto-valor').value;
    const categoria = document.getElementById('gasto-categoria').value;

    // Converte "R$ 10,00" em 10.00
    const valorNum = parseFloat(valorRaw.replace(/[^\d,]/g, '').replace(',', '.')) || 0;

    if (valorNum <= 0) {
        alert("O valor do gasto deve ser maior que R$ 0,00");
        return;
    }

    try {
        // Tenta obter o usuário logado
        let tenantId = null;
        try {
            const { data: { user } } = await window.supabaseClient.auth.getUser();
            if (user) tenantId = user.id;
        } catch (e) {
            console.log("Auth indisponível no momento. Usando bypass de desenvolvimento.");
        }

        // Se não houver usuário logado (projeto novo), gera um UUID fake fixo para teste local
        if (!tenantId) {
            tenantId = "00000000-0000-0000-0000-000000000000"; 
        }

        // Inserção no Supabase
        const { error } = await window.supabaseClient
            .from('despesas')
            .insert([
                {
                    tenant_id: tenantId,
                    descricao: descricao,
                    valor: valorNum,
                    categoria: categoria
                }
            ]);

        if (error) throw error;

        alert("Gasto fantasma registrado com sucesso!");
        fecharModalGasto();

    } catch (error) {
        console.error("Erro crítico ao salvar despesa:", error.message);
        alert("Falha ao salvar o gasto: " + error.message);
    }
}
function mascaraFechamentoMoeda(a) {
    let v = a.value.replace(/\D/g, "");
    v = (v / 100).toFixed(2) + "";
    v = v.replace(".", ",");
    v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    a.value = "R$ " + v;
}