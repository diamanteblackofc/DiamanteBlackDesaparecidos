// Armazena a lista local
let listaFotosDesaparecidos = [];

// ==========================================
// 0. INICIALIZAÇÃO AUTOMÁTICA (PUXAR DADOS)
// ==========================================
async function inicializarRobo() {
    try {
        // Alerte o usuário ou mude o estado se necessário.
        // Aqui assumimos que buscarDadosDoGitHub() está no seu arquivo github_db.js
        const dadosNuvem = await buscarDadosDoGitHub(); 
        
        if (dadosNuvem && Array.isArray(dadosNuvem)) {
            listaFotosDesaparecidos = dadosNuvem;
        } else if (dadosNuvem && typeof dadosNuvem === 'object') {
            // Caso o banco retorne um único objeto ou formato de chave-valor
            listaFotosDesaparecidos = Object.values(dadosNuvem);
        }
    } catch (erro) {
        console.error("Erro ao puxar dados do GitHub:", erro);
    } finally {
        // Renderiza o mural com os dados da nuvem ou mantém vazio se falhar
        renderizarMural();
    }
}

// Executa a busca assim que o script terminar de carregar no navegador
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarRobo);
} else {
    inicializarRobo();
}

// ==========================================
// 1. ESCUTA O EVENTO DE NOVO CADASTRO DISPARADO PELO INDEX
// ==========================================
document.addEventListener('novoCadastro', async (e) => {
    const dados = e.detail;
    
    // Pequeno ajuste para garantir compatibilidade com a leitura do arquivo
    const inputFoto = dados.fotoEl;
    const arquivo = (inputFoto && inputFoto.files) ? inputFoto.files[0] : null;
    
    if (!arquivo) return alert("Erro: Foto não encontrada.");

    const leitor = new FileReader();
    leitor.onload = async function(e) {
        const novaFicha = {
            id: Date.now(),
            fotoBase64: e.target.result,
            nome: dados.nome,
            idade: dados.idade || "Não informada",
            cidade: dados.cidade,
            desc: dados.desc || "Sem detalhes adicionais.", // Alinhado com o index
            whatsapp: dados.whats,
            status: "Procurando"
        };

        // Envia para a lista local no topo
        listaFotosDesaparecidos.unshift(novaFicha);
        
        // Atualiza a interface imediatamente para dar resposta rápida ao usuário
        renderizarMural();

        // Salva a lista inteira atualizada no GitHub
        const sucessoNuvem = await salvarDadosNoGitHub(listaFotosDesaparecidos);
        if (!sucessoNuvem) {
            alert("Aviso: O cadastro foi feito localmente, mas houve um erro ao salvar no GitHub.");
        }
    };
    leitor.readAsDataURL(arquivo);
});

// ==========================================
// 2. RENDERIZA O MURAL NO HTML
// ==========================================
function renderizarMural() {
    const mural = document.getElementById("mural");
    if (!mural) return;

    // Limpa absolutamente tudo o que estiver no mural (inclusive os skeletons/cards antigos)
    mural.innerHTML = '';

    if (listaFotosDesaparecidos.length === 0) {
        mural.innerHTML = '<p style="color: #fff; text-align: center; width: 100%; padding: 20px;">Nenhum registro encontrado.</p>';
        return;
    }

    listaFotosDesaparecidos.forEach(item => {
        const classeTag = item.status === "Achado" ? "achado" : "ativo";
        const textoTag = item.status === "Achado" ? "Achado! 🎉" : "Desaparecido";

        const cardHTML = `
            <article class="card-persona" onclick="abrirDetalhePorId(${item.id})" style="cursor: pointer;">
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
}

// ==========================================
// 3. ABRE DETALHE (CONECTADO AO MODAL DO INDEX)
// ==========================================
function abrirDetalhePorId(id) {
    const registro = listaFotosDesaparecidos.find(p => p.id === id);
    if (!registro) return;

    // Executa a função do index passando o formato correto
    abrirDetalhe({
        foto: registro.fotoBase64,
        nome: registro.nome,
        cidade: registro.cidade,
        idade: registro.idade,
        desc: registro.desc,
        whats: registro.whatsapp
    });

    // Corrige por fora o erro de sintaxe do index.html na exibição do texto do modal
    const txtMeta = document.getElementById('detalhe-meta-txt');
    if (txtMeta) {
        txtMeta.textContent = `${registro.cidade}${registro.idade ? ' · ' + registro.idade + ' anos' : ''}`;
    }
}

// ==========================================
// 4. LÓGICA DE ATUALIZAÇÃO DE STATUS
// ==========================================
async function marcarComoAchado(id) {
    const registro = listaFotosDesaparecidos.find(p => p.id === id);
    if (registro) {
        registro.status = "Achado";
        
        // Renderiza a alteração na tela na hora
        renderizarMural();
        fecharModal('modal-detalhe');
        
        // Atualiza a nuvem com o novo status
        const sucesso = await salvarDadosNoGitHub(listaFotosDesaparecidos);
        if (sucesso) {
            alert("Status atualizado para: ACHADO! 🎉");
        } else {
            alert("Erro ao atualizar o status no servidor do GitHub.");
        }
    }
}
