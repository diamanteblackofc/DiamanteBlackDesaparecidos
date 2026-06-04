// Configurações da IA
const CONFIG_IA = {
    urlHuggingFace: "https://hf.space/...", // (Insira a URL do seu Space aqui)
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
    
    // Opcional: Mostrar loading no painel se quiser
    
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

        renderizarFotosFiltradasIA(dadosFiltrados);

    } catch (erro) {
        console.error("Erro na busca IA:", erro);
        // Fallback local caso a IA falhe
        const fallbackLocal = (typeof listaFotosDesaparecidos !== 'undefined' ? listaFotosDesaparecidos : []).filter(item => {
            return item.cidade.toLowerCase().includes(fraseUsuario.toLowerCase()) || 
                   item.nome.toLowerCase().includes(fraseUsuario.toLowerCase()) || 
                   item.descricao.toLowerCase().includes(fraseUsuario.toLowerCase());
        });
        
        renderizarFotosFiltradasIA(fallbackLocal);
    }
}

// =================================================================
// RENDERIZADOR (Adaptado para o seu ID "mural")
// =================================================================
function renderizarFotosFiltradasIA(listaFiltrada) {
    const mural = document.getElementById("mural");
    if (!mural) return;

    // Remove os cards atuais
    mural.querySelectorAll('.card-pessoa').forEach(c => c.remove());

    if (!listaFiltrada || listaFiltrada.length === 0) {
        mural.innerHTML += `<div id="mural-vazio"><p>Nenhum registro encontrado com essas características.</p></div>`;
        return;
    }

    listaFiltrada.forEach(item => {
        const classeTag = item.status === "Achado" ? "achado" : "ativo";
        const textoTag = item.status === "Achado" ? "Achado! 🎉" : "Desaparecido";

        const cardHTML = `
            <article class="card-pessoa" onclick="abrirDetalheComId(${item.id})">
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
