// Armazena a lista local
let listaFotosDesaparecidos = [];

// 1. ESCUTA O EVENTO DE NOVO CADASTRO DISPARADO PELO INDEX
document.addEventListener('novoCadastro', async (e) => {
    const dados = e.detail;
    const arquivo = dados.fotoEl.files[0];
    
    if (!arquivo) return alert("Erro: Foto não encontrada.");

    const leitor = new FileReader();
    leitor.onload = async function(e) {
        const novaFicha = {
            id: Date.now(),
            fotoBase64: e.target.result,
            nome: dados.nome,
            idade: dados.idade || "Não informada",
            cidade: dados.cidade,
            desc: dados.desc || "Sem detalhes adicionais.", // CORRIGIDO: de descricao para desc
            whatsapp: dados.whats,
            status: "Procurando"
        };

        // Salva no GitHub
        const sucessoNuvem = await salvarDadosNoGitHub(novaFicha);
        if (sucessoNuvem) {
            listaFotosDesaparecidos.unshift(novaFicha);
            renderizarMural();
        }
    };
    leitor.readAsDataURL(arquivo);
});

// 2. RENDERIZA O MURAL NO HTML
function renderizarMural() {
    const mural = document.getElementById("mural");
    if (!mural) return;

    // Remove cards atuais, mantém o que for necessário
    const cardsAntigos = mural.querySelectorAll('.card-pessoa');
    cardsAntigos.forEach(c => c.remove());

    listaFotosDesaparecidos.forEach(item => {
        const classeTag = item.status === "Achado" ? "achado" : "ativo";
        const textoTag = item.status === "Achado" ? "Achado! 🎉" : "Desaparecido";

        const cardHTML = `
            <article class="card-pessoa" onclick="abrirDetalhePorId(${item.id})">
                <img src="${item.fotoBase64}" alt="${item.nome}">
                <div class="overlay"></div>
                <span class="card-tag ${classeTag}">${textoTag}</span>
                <div class="card-info">
                    <p class="card-nome">${item.nome}</p>
                    <p class="card-cidade">${item.cidade} · ${item.idade} anos</p>
                </div>
            </article>
        `;
        mural.insertAdjacentHTML("beforeend", cardHTML);
    });

    // CORREÇÃO EXTRAS: Força o sumiço dos quadradinhos de carregamento (skeletons) do index
    const skeletons = mural.querySelectorAll('.skeleton-card');
    skeletons.forEach(s => s.remove());
}

// 3. ABRE DETALHE (CONECTADO AO MODAL DO INDEX) - TOTALMENTE ADAPTADO
function abrirDetalhePorId(id) {
    const registro = listaFotosDesaparecidos.find(p => p.id === id);
    if (!registro) return;

    // Executa a função original do index (ela vai processar o desc corretamente agora)
    abrirDetalhe({
        foto: registro.fotoBase64,
        nome: registro.nome,
        cidade: registro.cidade,
        idade: registro.idade,
        desc: registro.desc, // Mudado para desc
        whats: registro.whatsapp
    });

    // GAMBIARRA DE SEGURANÇA: Corrige o bug de texto do index.html direto na tela por fora
    const txtMeta = document.getElementById('detalhe-meta-txt');
    if (txtMeta) {
        txtMeta.textContent = `${registro.cidade}${registro.idade ? ' · ' + registro.idade + ' anos' : ''}`;
    }
}

// 4. LÓGICA DE SUCESSO
function marcarComoAchado(id) {
    const registro = listaFotosDesaparecidos.find(p => p.id === id);
    if (registro) {
        registro.status = "Achado";
        salvarDadosNoGitHub(registro); 
        renderizarMural();
        fecharModal('modal-detalhe');
        alert("Status atualizado para: ACHADO! 🎉");
    }
}
