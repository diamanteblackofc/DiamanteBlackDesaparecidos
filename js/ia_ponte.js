// Configurações da IA
const CONFIG_IA = {
    urlHuggingFace: "https://hf.space...", // (Insira a URL do seu Space aqui)
    tokenAPI: "Bearer diamanteblack", 
};

// =================================================================
// RECEBE O SINAL DO INDEX.HTML (O BOTÃO "🌐 IA")
// =================================================================
document.addEventListener('buscaAvancada', async (e) => {
    const fraseUsuario = e.detail.query; // Pega a query enviada pelo index.html
    const token = e.detail.token;       // Pega o token configurado no Admin
    
    await processarBuscaInteligente(fraseUsuario, token);
});

// =================================================================
// O CÉREBRO DA IA
// =================================================================
async function processarBuscaInteligente(fraseUsuario, token) {
    console.log("🕵️‍♀️ Detetive DIAMANTE_BLACK analisando:", fraseUsuario);
    
    try {
        const registrosNuvem = typeof listaFotosDesaparecidos !== 'undefined' ? listaFotosDesaparecidos : [];

        const respostaIA = await fetch(CONFIG_IA.urlHuggingFace, {
            method: "POST",
            headers: { 
                "Authorization": token || CONFIG_IA.tokenAPI, 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({ 
                data: [fraseUsuario, JSON.stringify(registrosNuvem)] 
            })
        });

        if (!respostaIA.ok) throw new Error("Falha na resposta do Space");
        
        const resultadoGradio = await respostaIA.json();
        let dadosFiltrados = JSON.parse(resultadoGradio.data[0]);

        renderizarFotosFiltradasIA(dadosFiltrados, true); // true ativa o botão de voltar

    } catch (erro) {
        console.error("Erro na busca IA, usando busca local reserva:", erro);
        
        const fallbackLocal = (typeof listaFotosDesaparecidos !== 'undefined' ? listaFotosDesaparecidos : []).filter(item => {
            const cidade = item.cidade ? item.cidade.toLowerCase() : "";
            const nome = item.nome ? item.nome.toLowerCase() : "";
            const desc = item.desc ? item.desc.toLowerCase() : "";
            const busca = fraseUsuario.toLowerCase();

            return cidade.includes(busca) || nome.includes(busca) || desc.includes(busca);
        });
        
        renderizarFotosFiltradasIA(fallbackLocal, true); // true ativa o botão de voltar
    }
}

// =================================================================
// RENDERIZADOR (Com botão de voltar inteligente por JS)
// =================================================================
function renderizarFotosFiltradasIA(listaFiltrada, exibirBotaoVoltar = false) {
    const mural = document.getElementById("mural");
    if (!mural) return;

    // 1. Limpa o mural completamente
    mural.innerHTML = '';

    // 2. Cria e coloca o botão "Limpar Busca" dinamicamente por fora caso seja uma pesquisa
    if (exibirBotaoVoltar) {
        const botaoHTML = `
            <div id="container-limpar-busca" style="width: 100%; display: flex; justify-content: center; margin-bottom: 20px;">
                <button onclick="restaurarMuralCompleto()" style="
                    background: #ff4d4d; 
                    color: white; 
                    border: none; 
                    padding: 10px 20px; 
                    border-radius: 8px; 
                    font-weight: bold; 
                    cursor: pointer;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.2);
                    transition: 0.2s;
                " onmouseover="this.style.background='#ff3333'" onmouseout="this.style.background='#ff4d4d'">
                    ✖ Limpar Busca Inteligente
                </button>
            </div>
        `;
        // Coloca o botão imediatamente antes do grid de fotos começar
        mural.insertAdjacentHTML("beforebegin", botaoHTML);
    }

    if (!listaFiltrada || listaFiltrada.length === 0) {
        mural.innerHTML = `<div id="mural-vazio" style="width:100%; text-align:center; padding:20px;"><p style="color:#fff;">Nenhum registro encontrado com essas características.</p></div>`;
        return;
    }

    // 3. Renderiza os cards filtrados
    listaFiltrada.forEach(item => {
        const classeTag = item.status === "Achado" ? "achado" : "ativo";
        const textoTag = item.status === "Achado" ? "Achado! 🎉" : "Desaparecido";

        const cardHTML = `
            <article class="card-pessoa" onclick="abrirDetalhePorId(${item.id})" style="cursor: pointer;">
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

// =================================================================
// FUNÇÃO DE RESTAURAÇÃO (Volta para o mural original completo)
// =================================================================
function restaurarMuralCompleto() {
    // Remove o botão de limpar busca da tela para não ficar duplicando
    const botaoExistente = document.getElementById("container-limpar-busca");
    if (botaoExistente) botaoExistente.remove();

    // Chama a função original do robou.js que desenha o mural original com todas as fotos
    if (typeof renderizarMural === 'function') {
        renderizarMural();
        console.log("🤖 Mural completo restaurado pelo Robô!");
    } else {
        console.error("Não foi possível localizar a função renderizarMural do robô.");
    }
}
