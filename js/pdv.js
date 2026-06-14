// ✅ Alias para compatibilidade com window.supabaseClient do config.js
const _supabase = window.supabaseClient;

// =========================================================
// 2. VARIÁVEIS GLOBAIS
// =========================================================
let listaItensVendidos = [];
let totalGeral        = 0;
let formaSelecionada  = "";

let limiteSangria     = 500;
let caixaBloqueado    = false;
let contadorSangria   = 0;
let saldoFisicoCaixa  = 0;
let historicoSangrias = [];

// =========================================================
// 3. LOGIN
// =========================================================
async function efetuarLogin() {
    const nomeDigitado = document.getElementById('login-matricula').value.trim();
    const pinDigitado  = document.getElementById('login-senha').value.trim();

    if (!nomeDigitado || !pinDigitado) { alert("Por favor, preencha o nome e o PIN."); return; }

    try {
        const { data: usuario, error } = await _supabase
            .from('usuarios')
            .select('id, nome, cargo, pin')
            .ilike('nome', nomeDigitado)
            .eq('pin', pinDigitado)
            .maybeSingle();

        if (error) { alert('Erro ao conectar: ' + error.message); return; }
        if (!usuario) { alert('Usuário ou PIN incorretos.'); return; }

        window.usuarioLogado = usuario;
        localStorage.setItem('usuario_id',    usuario.id);
        localStorage.setItem('usuario_nome',  usuario.nome);
        localStorage.setItem('usuario_cargo', usuario.cargo);

        if (usuario.cargo === 'gerente' || usuario.cargo === 'admin') {
            localStorage.setItem('admin_autenticado', 'true');
            window.location.href = 'admin.html';
        } else {
            document.getElementById('nome-operador').innerText = usuario.nome;
            document.getElementById('modal-login').classList.add('hidden');
            document.getElementById('input-busca').focus();
        }
    } catch (err) {
        console.error("Erro técnico no login:", err);
        alert("Erro ao processar o login com o servidor.");
    }
}

// =========================================================
// 4. BUSCA DE PRODUTOS
// =========================================================
async function verificarEnter(event) {
    if (event.key !== 'Enter') return;
    let inputRaw = event.target.value.trim();
    if (!inputRaw) return;

    let quantidade = 1;
    let codigoParaBusca = inputRaw;

    if (inputRaw.includes('*') || inputRaw.toLowerCase().includes('x')) {
        const partes = inputRaw.split(/[*xX]/);
        quantidade = parseFloat(partes[0]) || 1;
        codigoParaBusca = partes[1] ? partes[1].trim() : "";
    }

    try {
        const { data } = await _supabase.from('estoque_produtos').select('*')
            .or(`codigo_barras.eq.${codigoParaBusca},nome.ilike.%${codigoParaBusca}%`)
            .maybeSingle();

        if (data) {
            const precoUnitario = parseFloat(data.preco_venda);
            const item = { nome: data.nome, qtd: quantidade, unit: precoUnitario, total: precoUnitario * quantidade, origem: 'barcode' };
            listaItensVendidos.push(item);
            totalGeral += item.total;
            renderizarCupom();
            atualizarTotal();
        } else {
            alert("Produto não cadastrado! Use F6 para registrar item sem código.");
        }
    } catch (err) {
        console.error("Erro na busca:", err);
        alert("Erro ao buscar produto.");
    } finally {
        event.target.value = "";
    }
}

// =========================================================
// 5. INTERFACE
// =========================================================
function renderizarCupom() {
    const listaHtml = document.getElementById('lista-produtos');
    if (listaItensVendidos.length === 0) {
        listaHtml.innerHTML = '<div class="flex items-center justify-center text-slate-300 italic text-sm h-full">Nenhum item adicionado</div>';
        return;
    }
    listaHtml.innerHTML = listaItensVendidos.map((item, index) => `
        <div class="grid grid-cols-6 items-center p-3 rounded-xl border mb-2 ${item.origem === 'f6plus' ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-100'}">
            <div class="col-span-3">
                <p class="font-bold text-slate-700 text-sm">${index + 1}. ${item.nome}</p>
                <p class="text-[10px] ${item.origem === 'f6plus' ? 'text-green-500' : 'text-slate-400'}">
                    ${item.origem === 'f6plus' ? '✏️ F6 Plus' : 'UN: R$ ' + item.unit.toFixed(2)}
                </p>
            </div>
            <div class="text-center font-bold text-slate-600 text-sm">${item.qtd}</div>
            <div class="text-right text-xs text-slate-400">R$ ${item.unit.toFixed(2)}</div>
            <div class="text-right font-black text-slate-800 text-sm">R$ ${item.total.toFixed(2)}</div>
        </div>
    `).join('');
    listaHtml.scrollTop = listaHtml.scrollHeight;
}

function atualizarTotal() {
    document.getElementById('valor-total-cupom').innerText =
        totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// =========================================================
// 6. FINALIZAR VENDA
// =========================================================
function finalizarVenda(forma) {
    if (caixaBloqueado) { abrirSangriaDeTrava(); return; }
    if (listaItensVendidos.length === 0) { alert("Carrinho vazio!"); return; }
    formaSelecionada = forma;
    document.getElementById('espera-venda').classList.add('hidden');
    document.getElementById('detalhes-pagamento').classList.remove('hidden');
    document.getElementById('resumo-subtotal').innerText = "R$ " + totalGeral.toFixed(2).replace('.', ',');
    document.getElementById('resumo-forma').innerText = forma;
    const blocoTroco = document.getElementById('bloco-troco');
    if (forma === 'Dinheiro') { blocoTroco.classList.remove('hidden'); document.getElementById('valor-recebido').focus(); }
    else { blocoTroco.classList.add('hidden'); }
}

// =========================================================
// 7. CONFIRMAR E IMPRIMIR
// =========================================================
async function confirmarEImprimir() {
    if (listaItensVendidos.length === 0) return;
    try {
        const { data: venda, error: erroVenda } = await _supabase
            .from('vendas')
            .insert({ total: totalGeral, forma_pagamento: formaSelecionada, operador: document.getElementById('nome-operador')?.innerText || "Operador" })
            .select().single();
        if (erroVenda) { alert("Erro ao gravar venda: " + erroVenda.message); return; }
        const itensFormatados = listaItensVendidos.map(item => ({ venda_id: venda.id, produto_nome: item.nome, quantidade: item.qtd, preco_unitario: item.unit, origem: String(item.origem || 'barcode') }));
        const { error: erroItens } = await _supabase.from('vendas_itens').insert(itensFormatados);
        if (erroItens) alert("Venda gravada, mas itens falharam.");
        const conteudoCupom = gerarTemplateCupom();
        const janela = window.open('', '', 'width=300,height=600');
        janela.document.write(`<html><body style="margin:0;">${conteudoCupom}</body></html>`);
        janela.document.close();
        setTimeout(() => { janela.print(); janela.close(); resetarCaixa(); }, 500);
    } catch (err) {
        console.error("Erro técnico:", err);
        alert("Erro inesperado. Verifique o console (F12).");
    }
}

// =========================================================
// 8. TEMPLATE DO CUPOM
// =========================================================
function gerarTemplateCupom() {
    const recebidoFormatado = document.getElementById('valor-recebido').value || "R$ " + totalGeral.toFixed(2);
    return `
        <div style="font-family:monospace;width:300px;padding:10px;">
            <center>
                <strong style="font-size:1.2em;">ROSAS DE JARDIM DELIVERY</strong><br>
                CNPJ: 00.000.000/0001-00<br>
                Endereço: Rua Exemplo, 123, Rio de Janeiro - RJ<br>
                --------------------------------<br>
                <strong>CUPOM NÃO FISCAL</strong><br>
                --------------------------------
            </center><br>
            ${listaItensVendidos.map(i => `<div>${i.nome.padEnd(20)} ${i.qtd}x R$ ${i.unit.toFixed(2)} ${i.origem === 'f6plus' ? '[+]' : ''}</div>`).join('')}
            <br>--------------------------------<br>
            <strong>SUBTOTAL: R$ ${totalGeral.toFixed(2)}</strong><br>
            PAGAMENTO: ${formaSelecionada}<br>
            VALOR PAGO: ${recebidoFormatado}<br>
            <strong>TROCO: ${document.getElementById('valor-troco').innerText}</strong><br>
            --------------------------------
            <center>Agradecemos a preferência!</center>
        </div>`;
}

// =========================================================
// 9. MOEDA
// =========================================================
function formatarMoeda(input) {
    let valor = input.value.replace(/\D/g, "");
    valor = (valor / 100).toFixed(2) + "";
    valor = valor.replace(".", ",");
    valor = valor.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    input.value = "R$ " + valor;
    const valorParaCalculo = parseFloat(input.value.replace("R$ ", "").replace(/\./g, "").replace(",", ".")) || 0;
    const troco = valorParaCalculo - totalGeral;
    const displayTroco = document.getElementById('valor-troco');
    if (displayTroco) {
        if (valorParaCalculo >= totalGeral) { displayTroco.innerText = "R$ " + troco.toFixed(2).replace(".", ","); displayTroco.style.color = "#16a34a"; }
        else { displayTroco.innerText = "Faltando..."; displayTroco.style.color = "#dc2626"; }
    }
}

function formatarMoedaF6(input) {
    let valor = input.value.replace(/\D/g, "");
    valor = (parseInt(valor || "0") / 100).toFixed(2);
    valor = valor.replace(".", ",");
    valor = valor.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    input.value = "R$ " + valor;
}

function lerPrecoF6() {
    const raw = document.getElementById('f6-preco-livre').value;
    return parseFloat(raw.replace("R$ ", "").replace(/\./g, "").replace(",", ".")) || 0;
}

function formatarMoedaSangria(input) {
    let valor = input.value.replace(/\D/g, "");
    valor = (parseInt(valor || "0") / 100).toFixed(2);
    valor = valor.replace(".", ",");
    valor = valor.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    input.value = "R$ " + valor;
    const retirada = lerValorSangria();
    const apos = Math.max(0, saldoFisicoCaixa - retirada);
    const el = document.getElementById('sangria-saldo-final');
    if (el) el.innerText = `R$ ${apos.toFixed(2).replace('.', ',')}`;
}

function lerValorSangria() {
    const raw = document.getElementById('sangria-valor').value;
    return parseFloat(raw.replace("R$ ", "").replace(/\./g, "").replace(",", ".")) || 0;
}

// =========================================================
// 10. RESETAR CAIXA
// =========================================================
function resetarCaixa() {
    listaItensVendidos = []; totalGeral = 0; formaSelecionada = "";
    [
        { id: 'lista-produtos',    fn: el => el.innerHTML = '' },
        { id: 'valor-total-cupom', fn: el => el.innerText  = 'R$ 0,00' },
        { id: 'resumo-subtotal',   fn: el => el.innerText  = 'R$ 0,00' },
        { id: 'valor-recebido',    fn: el => el.value      = '' },
        { id: 'valor-troco',       fn: el => el.innerText  = 'R$ 0,00' },
        { id: 'input-busca',       fn: el => el.value      = '' },
    ].forEach(({ id, fn }) => { const el = document.getElementById(id); if (el) fn(el); });
    document.getElementById('valor-troco')?.style && (document.getElementById('valor-troco').style.color = '');
    document.getElementById('espera-venda')?.classList.remove('hidden');
    document.getElementById('detalhes-pagamento')?.classList.add('hidden');
    document.getElementById('input-busca')?.focus();
}

// =========================================================
// 11. SANGRIA
// =========================================================
function verificarLimiteSangria() { if (saldoFisicoCaixa >= limiteSangria && !caixaBloqueado) travarCaixa(); }

function travarCaixa() {
    caixaBloqueado = true;
    const msg = document.getElementById('trava-saldo-msg');
    if (msg) msg.innerText = `Saldo em caixa: R$ ${saldoFisicoCaixa.toFixed(2).replace('.', ',')}`;
    const modal = document.getElementById('modal-trava');
    modal.classList.remove('hidden'); modal.classList.add('flex');
}

function abrirSangriaDeTrava() {
    document.getElementById('modal-trava').classList.add('hidden');
    document.getElementById('modal-trava').classList.remove('flex');
    abrirModalSangria(true);
}

function toggleSangria() { abrirModalSangria(false); }

function abrirModalSangria(forcada) {
    const modal = document.getElementById('modal-sangria');
    const avisoTrava = document.getElementById('aviso-trava-sangria');
    const btnCancel  = document.getElementById('btn-cancelar-sangria');
    const saldoEl    = document.getElementById('sangria-saldo-atual');
    const saldoFinal = document.getElementById('sangria-saldo-final');
    if (forcada) { avisoTrava?.classList.remove('hidden'); btnCancel?.classList.add('hidden'); }
    else { avisoTrava?.classList.add('hidden'); btnCancel?.classList.remove('hidden'); }
    if (saldoEl)    saldoEl.innerText    = `R$ ${saldoFisicoCaixa.toFixed(2).replace('.', ',')}`;
    if (saldoFinal) saldoFinal.innerText = `R$ ${saldoFisicoCaixa.toFixed(2).replace('.', ',')}`;
    document.getElementById('sangria-valor').value = '';
    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('sangria-valor').focus(), 150);
}

function fecharModalSangria() {
    document.getElementById('modal-sangria').style.display = 'none';
    document.getElementById('sangria-valor').value = '';
    document.getElementById('sangria-saldo-final').innerText = 'R$ 0,00';
    if (caixaBloqueado) travarCaixa();
}

async function confirmarSangria() {
    const valorRetirado = lerValorSangria();
    const motivo   = document.getElementById('sangria-motivo').value;
    const operador = document.getElementById('nome-operador').innerText;
    if (valorRetirado <= 0) { alert("Informe um valor válido!"); document.getElementById('sangria-valor').focus(); return; }
    if (valorRetirado > saldoFisicoCaixa) { alert(`Valor maior que o saldo (R$ ${saldoFisicoCaixa.toFixed(2).replace('.', ',')})`); return; }
    contadorSangria++;
    const agora = new Date();
    const dataHora = agora.toLocaleString('pt-BR');
    const saldoAntes  = saldoFisicoCaixa;
    const saldoDepois = saldoFisicoCaixa - valorRetirado;
    const registro = { numero: contadorSangria, data_hora: agora.toISOString(), operador, motivo, valor: valorRetirado, saldo_antes: saldoAntes, saldo_depois: saldoDepois };
    try { await _supabase.from('sangrias').insert(registro); } catch(e) { console.warn("Erro Supabase:", e); }
    historicoSangrias.push(registro);
    saldoFisicoCaixa = saldoDepois;
    caixaBloqueado   = false;
    ['modal-sangria', 'modal-trava'].forEach(id => { const m = document.getElementById(id); m.classList.add('hidden'); m.classList.remove('flex'); });
    imprimirComprovantesSangria({ numero: contadorSangria, dataHora, operador, motivo, valorRetirado, saldoAntes, saldoDepois });
    document.getElementById('input-busca')?.focus();
}

function imprimirComprovantesSangria(d) {
    const fmt = v => `R$ ${v.toFixed(2).replace('.', ',')}`;
    const linha = '--------------------------------';
    const via = n => `<div style="font-family:monospace;width:300px;padding:12px;margin-bottom:20px;border-bottom:2px dashed #999;"><center><strong>ROSAS DE JARDIM DELIVERY</strong><br>${linha}<br><strong>COMPROVANTE DE SANGRIA</strong><br>Via ${n} — ${n === 1 ? 'GERÊNCIA' : 'OPERADOR'}<br>${linha}</center><br>Nº Sangria : #${String(d.numero).padStart(4,'0')}<br>Data/Hora  : ${d.dataHora}<br>Operador   : ${d.operador}<br>Motivo     : ${d.motivo}<br>${linha}<br>Saldo antes   : ${fmt(d.saldoAntes)}<br><strong>Valor retirado: ${fmt(d.valorRetirado)}</strong><br>Saldo depois  : ${fmt(d.saldoDepois)}<br>${linha}<br><br>Assinatura:<br><br>____________________________<br>${d.operador}</div>`;
    const janela = window.open('', '', 'width=400,height=700');
    janela.document.write(`<html><body>${via(1)}${via(2)}</body></html>`);
    janela.document.close(); janela.print(); janela.close();
}

// =========================================================
// 12. F2
// =========================================================
function excluirUltimoItem() { abrirModalF2(); }

function abrirModalF2() {
    if (listaItensVendidos.length === 0) return;
    const modal = document.getElementById('modal-f2');
    const listaEl = document.getElementById('lista-f2');
    listaEl.innerHTML = listaItensVendidos.map((item, idx) => `
        <div onclick="excluirItemPorIndice(${idx})" class="cursor-pointer flex justify-between items-center p-3 rounded-xl border ${item.origem === 'f6plus' ? 'bg-green-50 border-green-200 hover:bg-green-100' : 'bg-slate-50 border-slate-200 hover:bg-red-50 hover:border-red-200'} transition-all group">
            <div><p class="font-bold text-slate-700 text-sm group-hover:text-red-600">${idx + 1}. ${item.nome}</p><p class="text-xs text-slate-400">${item.qtd}x R$ ${item.unit.toFixed(2)}</p></div>
            <div class="text-right"><p class="font-black text-slate-800 group-hover:text-red-600">R$ ${item.total.toFixed(2)}</p><p class="text-[10px] text-red-400 opacity-0 group-hover:opacity-100">clique para excluir</p></div>
        </div>`).join('');
    modal.classList.remove('hidden'); modal.classList.add('flex');
}

function excluirItemPorIndice(idx) {
    const removido = listaItensVendidos[idx];
    if (!removido) return;
    listaItensVendidos.splice(idx, 1);
    totalGeral = Math.max(0, totalGeral - removido.total);
    renderizarCupom(); atualizarTotal(); fecharModalF2();
    if (listaItensVendidos.length === 0) resetarCaixa();
}

function fecharModalF2() {
    const modal = document.getElementById('modal-f2');
    modal.classList.add('hidden'); modal.classList.remove('flex');
}

// =========================================================
// 13. F3
// =========================================================
function cancelarVenda() {
    if (listaItensVendidos.length === 0) return;
    if (confirm("Cancelar toda a venda?")) resetarCaixa();
}

// =========================================================
// 14. MULTIPLICAÇÃO
// =========================================================
function prepararMultiplicacao() {
    const campo = document.getElementById('input-busca');
    if (campo) { campo.value = "2*"; campo.focus(); campo.setSelectionRange(0, 1); }
}

// =========================================================
// 15. F9 — CONSULTA DE PREÇO
// =========================================================
function abrirConsultaPreco() {
    const modal = document.getElementById('modal-consulta');
    const input = document.getElementById('input-busca-preco');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); if (input) setTimeout(() => input.focus(), 100); }
}

function fecharModalConsulta() {
    const modal = document.getElementById('modal-consulta');
    if (modal) {
        modal.classList.add('hidden'); modal.classList.remove('flex');
        const input = document.getElementById('input-busca-preco');
        const resultado = document.getElementById('resultado-consulta');
        if (input) input.value = '';
        if (resultado) resultado.innerHTML = '<p class="text-sm text-center text-gray-500 py-4">Aguardando busca...</p>';
    }
}

// ✅ addEventListener dentro do DOMContentLoaded — evita erro quando elemento não existe
document.addEventListener('DOMContentLoaded', () => {
    const inputBuscaPreco = document.getElementById('input-busca-preco');
    if (!inputBuscaPreco) return;

    inputBuscaPreco.addEventListener('input', async (e) => {
        const termo = e.target.value.trim();
        const resultadoDiv = document.getElementById('resultado-consulta');
        if (termo.length === 0) { resultadoDiv.innerHTML = '<p class="text-sm text-center text-gray-500 py-4">Aguardando busca...</p>'; return; }
        try {
            const { data, error } = await _supabase.from('estoque_produtos').select('nome, preco_venda').or(`codigo_barras.eq.${termo},nome.ilike.%${termo}%`).limit(5);
            if (error) { console.error("Erro na busca:", error); return; }
            if (data && data.length > 0) {
                resultadoDiv.innerHTML = data.map(p => `<div class="flex justify-between p-2 border-b border-slate-100 hover:bg-slate-50"><span class="font-medium text-slate-700">${p.nome}</span><span class="font-bold text-green-600">R$ ${parseFloat(p.preco_venda).toFixed(2)}</span></div>`).join('');
            } else { resultadoDiv.innerHTML = '<p class="text-center text-gray-500">Produto não encontrado.</p>'; }
        } catch (err) { console.error("Erro inesperado:", err); }
    });
});

// =========================================================
// 16. F6 PLUS
// =========================================================
async function abrirRegistroPlus() {
    const modal = document.getElementById('modal-f6-plus');
    const listaPreCad = document.getElementById('lista-f6-precadastrada');
    document.getElementById('f6-nome-livre').value = '';
    document.getElementById('f6-quantidade-livre').value = '1';
    document.getElementById('f6-preco-livre').value = '';
    modal.classList.remove('hidden'); modal.classList.add('flex');
    setTimeout(() => document.getElementById('f6-nome-livre').focus(), 100);
    listaPreCad.innerHTML = '<p class="text-sm text-center text-slate-400 py-4">Carregando...</p>';
    try {
        const { data, error } = await _supabase.from('estoque_produtos').select('*').eq('categoria', 'artesanal');
        if (error || !data || data.length === 0) { listaPreCad.innerHTML = '<p class="text-sm text-center text-slate-400 py-4">Nenhum item artesanal cadastrado.</p>'; return; }
        listaPreCad.innerHTML = data.map(p => `<div onclick="_adicionarAoCupom('${p.nome}', ${p.preco_venda}, 1); fecharModalF6();" class="cursor-pointer flex justify-between items-center p-3 rounded-xl border bg-slate-50 border-slate-200 hover:bg-green-50 hover:border-green-300 transition-all"><span class="font-medium text-slate-700 text-sm">${p.nome}</span><span class="font-bold text-green-600">R$ ${parseFloat(p.preco_venda).toFixed(2)}</span></div>`).join('');
    } catch (e) { listaPreCad.innerHTML = '<p class="text-sm text-center text-red-400 py-4">Erro ao carregar.</p>'; }
}

function fecharModalF6() {
    const modal = document.getElementById('modal-f6-plus');
    modal.classList.add('hidden'); modal.classList.remove('flex');
    document.getElementById('input-busca')?.focus();
}

function adicionarItemManual() {
    const nome  = document.getElementById('f6-nome-livre').value.trim();
    const qtd   = parseInt(document.getElementById('f6-quantidade-livre').value) || 1;
    const preco = lerPrecoF6();
    if (!nome)                { alert("Informe o nome do produto!"); document.getElementById('f6-nome-livre').focus(); return; }
    if (!preco || preco <= 0) { alert("Informe um valor válido!"); document.getElementById('f6-preco-livre').focus(); return; }
    _adicionarAoCupom(nome.toUpperCase(), preco, qtd);
    fecharModalF6();
}

function _adicionarAoCupom(nome, preco, qtd) {
    const item = { nome, qtd, unit: preco, total: preco * qtd, origem: 'f6plus' };
    listaItensVendidos.push(item); totalGeral += item.total;
    renderizarCupom(); atualizarTotal();
}

// =========================================================
// 17. CONFIGURAR LIMITE
// =========================================================
function configurarLimiteSangria() {
    const senha = prompt("Senha do gerente:");
    if (senha !== "gerente123") { if (senha !== null) alert("Senha incorreta."); return; }
    const novoLimite = parseFloat(prompt(`Limite atual: R$ ${limiteSangria.toFixed(2)}\nNovo limite:`));
    if (!novoLimite || novoLimite <= 0) { alert("Valor inválido."); return; }
    limiteSangria = novoLimite;
    const el = document.getElementById('display-limite');
    if (el) el.innerText = novoLimite.toFixed(2).replace('.', ',');
    alert(`Limite atualizado para R$ ${novoLimite.toFixed(2).replace('.', ',')}`);
}

// =========================================================
// 18. TECLADO
// =========================================================
window.addEventListener('keydown', function(e) {
    const modal = document.getElementById('modal-login');
    const loginAberto = modal && !modal.classList.contains('hidden');
    if (loginAberto) return;
    switch (e.key) {
        case 'F2': e.preventDefault(); abrirModalF2();        break;
        case 'F3': e.preventDefault(); cancelarVenda();       break;
        case 'F4': e.preventDefault(); fecharCaixa();         break;
        case 'F5': e.preventDefault(); confirmarEImprimir();  break;
        case 'F6': e.preventDefault(); abrirRegistroPlus();   break;
        case 'F8': e.preventDefault(); abrirHistoricoVendas(); break;
        case 'F9': e.preventDefault(); abrirConsultaPreco();  break;
        case 'Escape':
            fecharModalHistorico(); fecharModalConsulta();
            fecharModalF6(); fecharModalF2(); fecharModalSangria();
            break;
    }
});

// =========================================================
// 19. HISTÓRICO / 2ª VIA
// =========================================================
async function imprimirSegundaVia() {
    try {
        const { data: ultimaVenda, error } = await _supabase.from('vendas').select('*').order('data_venda', { ascending: false }).limit(1).maybeSingle();
        if (error) { alert("Erro na busca: " + error.message); return; }
        if (!ultimaVenda) { alert("Nenhuma venda encontrada."); return; }
        const { data: itens } = await _supabase.from('vendas_itens').select('*').eq('venda_id', ultimaVenda.id);
        gerarLayoutImpressao(ultimaVenda, itens || []);
    } catch (err) { console.error("Erro técnico F8:", err); }
}

function gerarLayoutImpressao(venda, itens) {
    const janela = window.open('', '', 'width=400,height=600');
    janela.document.write(`<div style="font-family:monospace;width:300px;"><center><strong>REIMPRESSÃO 2ª VIA</strong></center><br>DATA: ${new Date(venda.created_at).toLocaleString()}<br>--------------------------------<br>${itens.map(i => `<div>${i.produto_nome} x${i.quantidade}</div>`).join('')}--------------------------------<br><strong>TOTAL: R$ ${parseFloat(venda.total).toFixed(2)}</strong><br>PAGAMENTO: ${venda.forma_pagamento}<br></div>`);
    janela.document.close(); janela.print();
}

async function abrirHistoricoVendas() {
    try {
        const { data: vendas, error } = await _supabase.from('vendas').select('id, total, data_venda, forma_pagamento, operador').order('data_venda', { ascending: false }).limit(4);
        if (error) throw error;
        const listaContainer = document.getElementById('lista-vendas-historico');
        listaContainer.innerHTML = '';
        vendas.forEach(v => {
            const dataObj = new Date(v.data_venda);
            const btn = document.createElement('button');
            btn.className = "w-full group bg-white border border-slate-200 p-4 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-left shadow-sm";
            btn.onclick = () => reimprimirVendaEspecifica(v.id);
            btn.innerHTML = `<div class="flex justify-between items-start mb-1"><span class="text-xs font-mono text-slate-400">ID: ${v.id.slice(0,8)}...</span><span class="font-black text-blue-600">R$ ${parseFloat(v.total).toFixed(2)}</span></div><div class="flex justify-between items-end"><div class="text-sm text-slate-600"><p class="font-semibold">${v.forma_pagamento}</p><p class="text-xs text-slate-400">${dataObj.toLocaleDateString('pt-BR')} às ${dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p></div><span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase font-bold group-hover:bg-blue-200 group-hover:text-blue-700">Reimprimir</span></div>`;
            listaContainer.appendChild(btn);
        });
        document.getElementById('modal-historico').classList.remove('hidden');
    } catch (err) { console.error("Erro na auditoria:", err.message); alert("Erro ao buscar histórico."); }
}

function fecharModalHistorico() {
    document.getElementById('modal-historico').classList.add('hidden');
}

// =========================================================
// 20. FECHAMENTO DE CAIXA
// =========================================================
async function fecharCaixa() {
    const confirmacao = confirm("Deseja encerrar o expediente e gerar o relatório?");
    if (!confirmacao) return;
    const nomeOperador = localStorage.getItem('usuario_nome') || 'Operador';
    const hoje = new Date().toISOString().split('T')[0];
    try {
        const { data: vendas, error } = await _supabase.from('vendas').select('total, forma_pagamento').ilike('operador', nomeOperador).gte('data_venda', `${hoje}T00:00:00.000Z`).lte('data_venda', `${hoje}T23:59:59.999Z`);
        if (error) throw error;
        let totalDinheiro = 0, totalCartao = 0, totalPix = 0, totalGeralDia = 0;
        (vendas || []).forEach(v => {
            const valor = parseFloat(v.total) || 0; totalGeralDia += valor;
            const forma = (v.forma_pagamento || '').toLowerCase();
            if (forma === 'dinheiro') totalDinheiro += valor;
            else if (forma === 'pix') totalPix += valor;
            else totalCartao += valor;
        });
        alert(`=========================================\n RELATÓRIO DE FECHAMENTO DE CAIXA\n Operador : ${nomeOperador}\n Data     : ${new Date().toLocaleDateString('pt-BR')}\n=========================================\n\n🟢 DINHEIRO : R$ ${totalDinheiro.toFixed(2)}\n🔵 CARTÃO   : R$ ${totalCartao.toFixed(2)}\n🔶 PIX      : R$ ${totalPix.toFixed(2)}\n-----------------------------------------\n💰 TOTAL    : R$ ${totalGeralDia.toFixed(2)}\n=========================================`);
    } catch (err) { console.error("Erro ao gerar fechamento:", err); alert("Erro ao puxar o relatório."); }
}

// =========================================================
// 21. LOGIN ADMIN (Escopo Global para o PDV Profissional)
// =========================================================
window.abrirLoginAdmin = function() {
    const modal = document.getElementById('modal-login-admin');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('user-admin').value = '';
        document.getElementById('pass-admin').value = '';
        setTimeout(() => document.getElementById('user-admin').focus(), 100);
    } else {
        console.error("❌ Elemento 'modal-login-admin' não foi encontrado nesta página do PDV.");
    }
};

window.fecharLoginAdmin = function() {
    const modal = document.getElementById('modal-login-admin');
    if (modal) modal.classList.add('hidden');
};

// Vinculando a nova validação do Supabase que fizemos também ao escopo global
window.validarAcessoAdmin = async function() {
    // 🔀 TRUQUE TEMPORÁRIO PARA GRAVAR COM O OBS: Entra direto sem checar o banco
    localStorage.setItem('admin_autenticado', 'true');
    window.location.href = 'admin.html';
    return; // Para o código aqui e ignora o erro do banco

    try {
        // Busca usando a instância do Supabase configurada nesse PDV
        // Nota: Se a sua variável do Supabase aqui se chamar apenas 'supabase' em vez de '_supabase', mude abaixo:
        const { data: usuario, error } = await _supabase
            .from('usuarios')
            .select('id, nome, cargo, pin')
            .ilike('nome', user)
            .eq('pin', pass)
            .maybeSingle();

        if (error) {
            alert('Erro ao conectar ao banco: ' + error.message);
            return;
        }

        if (!usuario) {
            alert('❌ Credenciais incorretas!');
            return;
        }

        if (usuario.cargo === 'gerente' || usuario.cargo === 'admin') {
            localStorage.setItem('admin_autenticado', 'true');
            localStorage.setItem('usuario_id', usuario.id);
            localStorage.setItem('usuario_nome', usuario.nome);
            localStorage.setItem('usuario_cargo', usuario.cargo);
            
            window.location.href = 'admin.html';
        } else {
            alert('⚠️ Acesso negado: Seu cargo não tem permissão de Administrador.');
        }

    } catch (err) {
        console.error("Erro técnico ao validar administrador:", err);
        alert("Erro ao processar o login administrativo.");
    }
};
function abrirModalAdmin() {
    // Código para mostrar o modal ou gerar o relatório
    console.log("Abrindo painel administrativo...");
    // Exemplo se tiver um elemento com esse ID:
    const modal = document.getElementById('modal-admin');
    if (modal) modal.classList.remove('hidden');
}

// Função simples para formatar enquanto digita no fechamento
function formatarMoedaSimples(input) {
    let v = input.value.replace(/\D/g, '');
    let valorNum = (parseInt(v, 10) / 100) || 0;
    input.value = valorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
// FORÇAR A MÁSCARA NO JAVASCRIPT
function mascaraFechamentoMoeda(input) {
    // 1. Remove tudo o que não for número
    let v = input.value.replace(/\D/g, ''); 
    
    // Se o campo for esvaziado, mantém limpo
    if (!v) {
        input.value = '';
        return;
    }
    
    // 2. Transforma em centavos (anda com a vírgula)
    let valorNum = (parseInt(v, 10) / 100);
    
    // 3. Força a formatação em Reais e joga de volta no input
    input.value = valorNum.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}
async function processarTrocaTurno() {
    // 1. CAPTURA O INPUT DO HTML (O campo escuro com R$ 0,00)
    const campoFisico = document.getElementById('valor-fechamento-fisico');
    
    if (!campoFisico || !campoFisico.value) {
        alert("Por favor, digite o valor em dinheiro na gaveta antes de confirmar.");
        campoFisico?.focus();
        return;
    }

    // 2. Transforma o texto "R$ 1.234,00" que está no campo em um número limpo (1234.00)
    const valorInformado = parseFloat(campoFisico.value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;

    // 3. Captura o valor que o sistema calculou automaticamente na tela
    const textoEsperado = document.getElementById('rep-total-caixa-especado').textContent;
    const valorEsperado = parseFloat(textoEsperado.replace(/[^\d,]/g, '').replace(',', '.')) || 0;

    // 4. Faz a matemática da auditoria (Diferença)
    const diferenca = valorInformado - valorEsperado;
    let resumo = "";

    if (diferenca === 0) {
        resumo = "✅ Caixa Perfeito!";
    } else if (diferenca > 0) {
        resumo = `⚠️ Sobra de Caixa: R$ ${diferenca.toFixed(2).replace('.', ',')} a mais.`;
    } else {
        resumo = `❌ QUEBRA DE CAIXA! Faltam R$ ${Math.abs(diferenca).toFixed(2).replace('.', ',')} na gaveta.`;
    }

    // 5. Pergunta final se deseja encerrar usando os dados lidos do HTML
    if (confirm(`${resumo}\n\nValor Esperado: R$ ${valorEsperado.toFixed(2).replace('.', ',')}\nValor Informado: R$ ${valorInformado.toFixed(2).replace('.', ',')}\n\nDeseja confirmar o fechamento do turno?`)) {
        
        const novoOperador = prompt("Digite o nome do PRÓXIMO operador:");
        if (novoOperador) {
            document.getElementById('rep-operador').textContent = novoOperador;
            document.getElementById('rep-data-abertura').textContent = new Date().toLocaleString('pt-BR');
            
            // Limpa o campo porque a operação foi concluída com SUCESSO
            campoFisico.value = '';
            
            alert(`Turno de ${novoOperador} iniciado com sucesso!`);
            document.getElementById('modal-admin').classList.add('hidden');
        } else {
            // Se ele aceitou o fechamento mas não digitou o próximo operador, limpa também por segurança
            campoFisico.value = '';
        }
        
    } else {
        // >>> O PULO DO GATO ESTÁ AQUI <<<
        // Se o operador clicou em CANCELAR no confirm, limpamos o campo na hora!
        campoFisico.value = '';
    }
}
// FUNÇÃO PARA ATUALIZAR O RELÓGIO EM TEMPO REAL
function iniciarRelogioPainel() {
    const elementoRelogio = document.getElementById('relogio-painel');
    
    // Se o elemento não existir na tela atual, interrompe para não dar erro
    if (!elementoRelogio) return;

    // Executa a atualização a cada 1000 milissegundos (1 segundo)
    setInterval(() => {
        const agora = new Date();
        
        // Formata para o padrão brasileiro: DD/MM/AAAA HH:MM:SS
        const dataHoraFormatada = agora.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        // Injeta o texto atualizado no HTML
        elementoRelogio.textContent = dataHoraFormatada;
    }, 1000);
}

// Inicia o relógio assim que o arquivo JS for carregado pelo navegador
iniciarRelogioPainel();
// Define a data de abertura inicial assim que a página carrega
document.getElementById('rep-data-abertura').textContent = new Date().toLocaleString('pt-BR');
function abrirModalGasto() {
    document.getElementById('modal-gasto').classList.remove('hidden');
    document.getElementById('gasto-descricao').focus();
}

function fecharModalGasto() {
    document.getElementById('modal-gasto').classList.add('hidden');
    document.getElementById('form-gasto').reset();
}
async function salvarGasto(event) {
    event.preventDefault();

    const descricao = document.getElementById('gasto-descricao').value.trim();
    const valorRaw = document.getElementById('gasto-valor').value;
    const categoria = document.getElementById('gasto-categoria').value;

    // Tratamento estrito do valor monetário para o PostgreSQL (NUMERIC)
    const valorNum = parseFloat(valorRaw.replace(/[^\d,]/g, '').replace(',', '.')) || 0;

    if (valorNum <= 0) {
        alert("O valor do gasto deve ser maior que R$ 0,00");
        return;
    }

    try {
        // Obter o tenant_id do usuário logado (Regra Multi-tenant)
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        
        if (!user) throw new Error("Usuário não autenticado.");

        // Inserção na tabela do Administra Fácil
        const { error } = await window.supabaseClient
            .from('despesas')
            .insert([
                {
                    tenant_id: user.id, // Vincula diretamente ao ID do dono/empresa
                    descricao: descricao,
                    valor: valorNum,
                    categoria: categoria
                }
            ]);

        if (error) throw error;

        alert("Gasto fantasma registrado com sucesso!");
        fecharModalGasto();

        // Uma função futura para atualizar os gráficos será chamada aqui:
        // atualizarGraficosDespesas();

    } catch (error) {
        console.error("Erro crítico ao salvar despesa:", error.message);
        alert("Falha ao salvar o gasto. Verifique a conexão com o banco de dados.");
    }
}
// =======================================================
// MÓDULO LOGÍSTICA: GESTÃO DE ENTREGADORES
// =======================================================

// =======================================================
// 22. MODULO DE LOGÍSTICA E CONTROLE DE ENTREGADORES
// =======================================================

async function abrirModalEntregadores() {
    document.getElementById('modal-entregadores').classList.remove('hidden');
    renderizarEntregadores();
}

function fecharModalEntregadores() {
    document.getElementById('modal-entregadores').classList.add('hidden');
}

async function abrirModalDespacho() {
    document.getElementById('modal-entregadores').classList.add('hidden');
    document.getElementById('modal-despacho-entrega').classList.remove('hidden');
    
    const select = document.getElementById('despacho-entregador');
    select.innerHTML = '<option value="">Carregando motoboys...</option>';

    try {
        const { data: motoboys } = await _supabase
            .from('entregadores')
            .select('*')
            .eq('status', 'Disponível');

        if (!motoboys || motoboys.length === 0) {
            select.innerHTML = '<option value="">Nenhum motoboy disponível</option>';
            return;
        }

        select.innerHTML = motoboys.map(m => `<option value="${m.id}">${m.nome} (${m.codigo_rastreio})</option>`).join('');
    } catch (err) {
        console.error("Erro ao carregar selects:", err.message);
    }
}

function fecharModalDespacho() {
    document.getElementById('modal-despacho-entrega').classList.add('hidden');
    document.getElementById('form-despacho').reset();
    document.getElementById('modal-entregadores').classList.remove('hidden');
    renderizarEntregadores();
}

async function salvarDespacho(e) {
    e.preventDefault();
    const entregadorId = document.getElementById('despacho-entregador').value;
    const pedidoCodigo = document.getElementById('despacho-pedido').value;
    const endereco = document.getElementById('despacho-endereco').value;
    const placa = document.getElementById('despacho-placa').value.toUpperCase();

    try {
        if (placa) {
            await _supabase.from('entregadores').update({ placa_moto: placa, status: 'Em Rota' }).eq('id', entregadorId);
        } else {
            await _supabase.from('entregadores').update({ status: 'Em Rota' }).eq('id', entregadorId);
        }

        const { error } = await _supabase.from('entregas').insert([{
            entregador_id: entregadorId,
            endereco_entrega: endereco,
            status_entrega: 'Saiu para Entrega',
            hora_saida: new Date().toISOString()
        }]);

        if (error) throw error;
        alert(`Pedido ${pedidoCodigo} despachado com sucesso!`);
        fecharModalDespacho();
    } catch (err) {
        alert("Erro ao despachar entrega: " + err.message);
    }
}

async function finalizarEntregaNoBanco(entregaId, entregadorId) {
    try {
        await _supabase.from('entregas').update({ status_entrega: 'Entregue', hora_recebimento: new Date().toISOString() }).eq('id', entregaId);
        await _supabase.from('entregadores').update({ status: 'Disponível' }).eq('id', entregadorId);
        alert("Entrega finalizada com sucesso!");
        renderizarEntregadores();
    } catch (err) {
        console.error("Erro ao finalizar rota:", err.message);
    }
}

async function renderizarEntregadores() {
    const container = document.getElementById('lista-entregadores-corpo');
    if (!container) return;
    try {
        const { data: motoboys } = await _supabase.from('entregadores').select('*').order('nome', { ascending: true });
        const { data: entregasAtivas } = await _supabase.from('entregas').select('*').not('status_entrega', 'eq', 'Entregue');

        let htmlResultado = '';
        htmlResultado += `<h4 class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">🏍️ Status da Equipe</h4><div class="grid gap-1.5 mb-4">`;
        
        (motoboys || []).forEach(moto => {
            const emRota = moto.status === 'Em Rota' || moto.status === 'Em entrega';
            const corStatus = emRota ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            htmlResultado += `<div class="flex items-center justify-between p-2 bg-slate-950/40 border border-slate-800 rounded-xl"><div><span class="text-xs font-bold text-slate-200">${moto.nome}</span><p class="text-[10px] text-slate-500 font-mono">${moto.codigo_rastreio} ${moto.placa_moto ? '• ' + moto.placa_moto : ''}</p></div><span class="text-[10px] font-semibold px-2 py-0.5 border rounded-full ${corStatus}">${moto.status}</span></div>`;
        });
        htmlResultado += `</div>`;

        htmlResultado += `<h4 class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 pt-2 border-t border-slate-800/60">📦 Entregas em Andamento</h4>`;
        if (!entregasAtivas || entregasAtivas.length === 0) {
            htmlResultado += `<div class="text-center text-xs text-slate-600 py-4">Nenhum pedido na rua no momento.</div>`;
        } else {
            htmlResultado += `<div class="grid gap-1.5">`;
            entregasAtivas.forEach(entrega => {
                const horaSaida = entrega.hora_saida ? new Date(entrega.hora_saida).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--';
                const motoC = (motoboys || []).find(m => m.id === entrega.entregador_id);
                htmlResultado += `<div class="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between gap-2"><div class="space-y-0.5 max-w-[70%]"><div class="flex items-center gap-2"><span class="text-[10px] font-bold text-purple-400">Saiu às ${horaSaida}</span><span class="text-[10px] text-slate-400 truncate">Condutor: ${motoC ? motoC.nome : 'Motoboy'}</span></div><p class="text-[11px] text-slate-300 truncate font-mono">${entrega.endereco_entrega}</p></div><button onclick="finalizarEntregaNoBanco('${entrega.id}', '${entrega.entregador_id}')" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-lg transition-all cursor-pointer whitespace-nowrap shadow-sm">✓ Entregue</button></div>`;
            });
            htmlResultado += `</div>`;
        }
        container.innerHTML = htmlResultado;
    } catch (err) {
        container.innerHTML = `<div class="text-center text-xs text-red-400 py-4">Falha ao carregar dados.</div>`;
    }
}