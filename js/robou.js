// =====================================================================
// DIAMANTE BLACK RASTREADOR — robou.js
// Motor do mural: cadastro, renderização, detalhes, status e delete
// =====================================================================

// Lista local em memória (sincronizada com GitHub via github_db.js)
let listaFotosDesaparecidos = [];

// =====================================================================
// 0. INICIALIZAÇÃO — Puxar dados e renderizar mural
// =====================================================================
async function inicializarRobo() {
    try {
        // ✅ CORRIGIDO: buscarDadosDoGitHub() agora existe em github_db.js
        const dadosNuvem = await buscarDadosDoGitHub();

        if (Array.isArray(dadosNuvem)) {
            listaFotosDesaparecidos = dadosNuvem;
        }
    } catch (erro) {
        console.error("❌ Erro ao puxar dados do GitHub:", erro);
    } finally {
        renderizarMural();

        // Avisa o index.html para remover skeletons e atualizar contador
        document.dispatchEvent(new CustomEvent('muralCarregado', {
            detail: { total: listaFotosDesaparecidos.length }
        }));
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarRobo);
} else {
    inicializarRobo();
}

// =====================================================================
// 1. EVENTO: NOVO CADASTRO (disparado pelo index.html)
// =====================================================================
document.addEventListener('novoCadastro', async (e) => {
    const dados = e.detail;

    const inputFoto = dados.fotoEl;
    const arquivo = (inputFoto && inputFoto.files) ? inputFoto.files[0] : null;

    if (!arquivo) {
        alert("Erro: adicione uma foto antes de publicar.");
        return;
    }

    const leitor = new FileReader();
    leitor.onload = async function (ev) {
        const novaFicha = {
            id: Date.now(),
            fotoBase64: ev.target.result,
            nome: dados.nome,
            idade: dados.idade || "Não informada",
            cidade: dados.cidade,
            desc: dados.desc || "Sem detalhes adicionais.",
            whatsapp: dados.whats,
            status: "Procurando"
        };

        listaFotosDesaparecidos.unshift(novaFicha);
        renderizarMural();

        // Atualiza contador
        document.getElementById('total-registros').textContent = listaFotosDesaparecidos.length;

        // Salva no GitHub passando a lista completa
        const sucesso = await salvarDadosNoGitHub(listaFotosDesaparecidos);
        if (!sucesso) {
            alert("⚠️ Cadastro feito localmente, mas houve erro ao salvar no servidor.");
        }
    };
    leitor.readAsDataURL(arquivo);
});

// =====================================================================
// 2. RENDERIZAR MURAL
// ✅ CORRIGIDO: class "card-pessoa" (igual ao CSS do index.html)
//    Antes estava "card-persona" → CSS não aplicava
// =====================================================================
function renderizarMural() {
    const mural = document.getElementById("mural");
    if (!mural) return;

    mural.innerHTML = '';

    if (listaFotosDesaparecidos.length === 0) {
        mural.innerHTML = `
            <div id="mural-vazio" style="grid-column:1/-1; text-align:center; padding:60px 20px;">
                <div style="font-size:48px; opacity:0.2;">🔍</div>
                <p style="color:var(--cinza); font-size:14px; letter-spacing:1px; margin-top:16px;">
                    Nenhum registro no mural ainda.<br>Seja o primeiro a cadastrar.
                </p>
            </div>`;
        return;
    }

    listaFotosDesaparecidos.forEach(item => {
        const classeTag = item.status === "Achado" ? "achado" : "ativo";
        const textoTag  = item.status === "Achado" ? "Achado 🎉" : "Desaparecido";

        // ✅ CORRIGIDO: "card-pessoa" (igual ao CSS do index.html)
        const cardHTML = `
            <article class="card-pessoa" onclick="abrirDetalhePorId(${item.id})" style="cursor:pointer;">
                <img src="${item.fotoBase64}" alt="${escapeHtml(item.nome)}" loading="lazy">
                <div class="overlay"></div>
                <span class="card-tag ${classeTag}">${textoTag}</span>
                <div class="card-info">
                    <p class="card-nome">${escapeHtml(item.nome)}</p>
                    <p class="card-cidade">${escapeHtml(item.cidade)} · ${escapeHtml(String(item.idade))}</p>
                </div>
            </article>
        `;
        mural.insertAdjacentHTML("beforeend", cardHTML);
    });

    // Atualiza contador no header do mural
    const totalEl = document.getElementById('total-registros');
    if (totalEl) totalEl.textContent = listaFotosDesaparecidos.length;
}

// =====================================================================
// 3. ABRIR DETALHE POR ID
// ✅ CORRIGIDO: Agora passa o `id` para abrirDetalhe → habilita
//    "Marcar como Achado" e "Apagar Minha Postagem"
// =====================================================================
function abrirDetalhePorId(id) {
    const registro = listaFotosDesaparecidos.find(p => String(p.id) === String(id));
    if (!registro) return;

    // ✅ CORRIGIDO: passa o id para o index.html poder usar no botão Achado/Delete
    abrirDetalhe({
        id:    registro.id,
        foto:  registro.fotoBase64,
        nome:  registro.nome,
        cidade: registro.cidade,
        idade: registro.idade,
        desc:  registro.desc,
        whats: registro.whatsapp
    });

    // Corrige o texto de meta que o index.html montava com template errado
    const txtMeta = document.getElementById('detalhe-meta-txt');
    if (txtMeta) {
        txtMeta.textContent = `${registro.cidade}${registro.idade ? ' · ' + registro.idade + ' anos' : ''}`;
    }
}

// =====================================================================
// 4. MARCAR COMO ACHADO
// =====================================================================
async function marcarComoAchado(id) {
    const registro = listaFotosDesaparecidos.find(p => String(p.id) === String(id));
    if (!registro) {
        alert("❌ Registro não encontrado.");
        return;
    }

    registro.status = "Achado";
    renderizarMural();

    if (typeof fecharModal === 'function') fecharModal('modal-detalhe');

    const sucesso = await salvarDadosNoGitHub(listaFotosDesaparecidos);
    alert(sucesso
        ? "🎉 Status atualizado para ACHADO! Obrigado por usar o Diamante Rastreador."
        : "⚠️ Status atualizado localmente, mas erro ao salvar no servidor."
    );
}

// =====================================================================
// 5. APAGAR PRÓPRIA POSTAGEM (nova feature)
// Usuário digita o WhatsApp cadastrado → se bater, apaga
// =====================================================================
async function apagarMinhaPostagem(id) {
    const registro = listaFotosDesaparecidos.find(p => String(p.id) === String(id));
    if (!registro) { alert("Registro não encontrado."); return; }

    // Pede confirmação com verificação pelo WhatsApp
    const whatsDigitado = prompt(
        `Para confirmar a exclusão de "${registro.nome}", \ndigite o WhatsApp cadastrado na postagem:`
    );

    if (whatsDigitado === null) return; // Cancelou

    // Normaliza comparação (só números)
    const normalizar = s => String(s).replace(/\D/g, '');
    if (normalizar(whatsDigitado) !== normalizar(registro.whatsapp)) {
        alert("❌ WhatsApp incorreto. Só quem criou a postagem pode apagá-la.");
        return;
    }

    if (!confirm(`Tem certeza que deseja apagar a postagem de "${registro.nome}"? Esta ação não pode ser desfeita.`)) return;

    listaFotosDesaparecidos = listaFotosDesaparecidos.filter(p => String(p.id) !== String(id));
    renderizarMural();

    if (typeof fecharModal === 'function') fecharModal('modal-detalhe');

    const sucesso = await salvarDadosNoGitHub(listaFotosDesaparecidos);
    alert(sucesso
        ? "✅ Postagem removida com sucesso."
        : "⚠️ Removido localmente, mas erro ao sincronizar com o servidor."
    );
}

// =====================================================================
// 6. COMPARTILHAR POSTAGEM (nova feature)
// =====================================================================
function compartilharPostagem(dados) {
    const texto = `🔍 *DIAMANTE RASTREADOR — Pessoa Desaparecida*\n\n` +
        `👤 Nome: ${dados.nome}\n` +
        `📍 Cidade: ${dados.cidade}\n` +
        `🎂 Idade: ${dados.idade || 'Não informada'}\n` +
        `📝 Detalhes: ${dados.desc || 'Sem detalhes'}\n\n` +
        `Se você tiver informações, entre em contato:\n` +
        `https://wa.me/55${String(dados.whats).replace(/\D/g, '')}`;

    if (navigator.share) {
        navigator.share({
            title: `Pessoa Desaparecida — ${dados.nome}`,
            text: texto,
            url: window.location.href
        }).catch(() => {});
    } else {
        // Fallback: copia para clipboard
        navigator.clipboard.writeText(texto).then(() => {
            alert("📋 Informações copiadas para a área de transferência!\nCole no WhatsApp ou redes sociais para compartilhar.");
        }).catch(() => {
            // Último fallback: WhatsApp Web direto
            const urlWhats = `https://wa.me/?text=${encodeURIComponent(texto)}`;
            window.open(urlWhats, '_blank');
        });
    }
}

// =====================================================================
// 7. BUSCA LOCAL (filtro no mural ao digitar)
// =====================================================================
const campoBusca = document.getElementById('campo-busca');
if (campoBusca) {
    campoBusca.addEventListener('input', () => {
        const termo = campoBusca.value.trim().toLowerCase();
        if (!termo) {
            renderizarMural();
            return;
        }
        const filtrados = listaFotosDesaparecidos.filter(item => {
            return (
                (item.nome   || '').toLowerCase().includes(termo) ||
                (item.cidade || '').toLowerCase().includes(termo) ||
                (item.desc   || '').toLowerCase().includes(termo)
            );
        });
        renderizarFotosFiltradasIA(filtrados, false);
    });
}

// =====================================================================
// 8. RENDERIZAR LISTA FILTRADA (chamado por ia_ponte.js também)
// =====================================================================
function renderizarFotosFiltradasIA(listaFiltrada, exibirBotaoVoltar = true) {
    const mural = document.getElementById("mural");
    if (!mural) return;

    // Remove botão de limpar anterior
    const botaoAntigo = document.getElementById("container-limpar-busca");
    if (botaoAntigo) botaoAntigo.remove();

    mural.innerHTML = '';

    if (exibirBotaoVoltar) {
        const botaoHTML = `
            <div id="container-limpar-busca" style="grid-column:1/-1; display:flex; justify-content:center; margin-bottom:12px;">
                <button onclick="restaurarMuralCompleto()" style="
                    background:var(--perigo);color:#fff;border:none;
                    padding:10px 20px;border-radius:8px;font-weight:bold;
                    cursor:pointer;letter-spacing:1px;font-size:13px;
                ">✖ Limpar Busca</button>
            </div>`;
        mural.insertAdjacentHTML("beforebegin", botaoHTML);
    }

    if (!listaFiltrada || listaFiltrada.length === 0) {
        mural.innerHTML = `
            <div id="mural-vazio" style="grid-column:1/-1;text-align:center;padding:40px 20px;">
                <div style="font-size:36px;opacity:0.3;">🔍</div>
                <p style="color:var(--cinza);margin-top:12px;">Nenhum resultado encontrado.</p>
            </div>`;
        return;
    }

    listaFiltrada.forEach(item => {
        const classeTag = item.status === "Achado" ? "achado" : "ativo";
        const textoTag  = item.status === "Achado" ? "Achado 🎉" : "Desaparecido";

        const cardHTML = `
            <article class="card-pessoa" onclick="abrirDetalhePorId(${item.id})" style="cursor:pointer;">
                <img src="${item.fotoBase64}" alt="${escapeHtml(item.nome)}" loading="lazy">
                <div class="overlay"></div>
                <span class="card-tag ${classeTag}">${textoTag}</span>
                <div class="card-info">
                    <p class="card-nome">${escapeHtml(item.nome)}</p>
                    <p class="card-cidade">${escapeHtml(item.cidade)} · ${escapeHtml(String(item.idade))}</p>
                </div>
            </article>`;
        mural.insertAdjacentHTML("beforeend", cardHTML);
    });
}

// =====================================================================
// 9. RESTAURAR MURAL COMPLETO
// =====================================================================
function restaurarMuralCompleto() {
    const botao = document.getElementById("container-limpar-busca");
    if (botao) botao.remove();

    // Limpa campo de busca também
    const campo = document.getElementById('campo-busca');
    if (campo) campo.value = '';

    renderizarMural();
}

// =====================================================================
// UTILITÁRIO: Previne XSS ao inserir HTML
// =====================================================================
function escapeHtml(str) {
    if (typeof str !== 'string') return String(str || '');
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
