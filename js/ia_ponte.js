// =====================================================================
// DIAMANTE BLACK RASTREADOR — ia_ponte.js
// Busca avançada via IA (HuggingFace Space) com fallback local
// =====================================================================

// ⚠️ Configure a URL do seu Space no painel Admin → Token da API
// O token digitado no Admin é passado pelo index.html no evento buscaAvancada
const CONFIG_IA = {
    // URL do seu Gradio Space no HuggingFace — configure via Admin
    // Ex: "https://SEU-USUARIO-SEU-SPACE.hf.space/run/predict"
    urlHuggingFace: "",
};

// =====================================================================
// RECEBE EVENTO DO index.html (botão 🌐 IA)
// =====================================================================
document.addEventListener('buscaAvancada', async (e) => {
    const fraseUsuario = e.detail.query;
    const token        = e.detail.token; // vem do painel Admin

    await processarBuscaInteligente(fraseUsuario, token);
});

// =====================================================================
// CÉREBRO DA BUSCA
// =====================================================================
async function processarBuscaInteligente(fraseUsuario, token) {
    console.log("🕵️ DIAMANTE_IA analisando:", fraseUsuario);

    // Mostra feedback visual enquanto busca
    mostrarLoadingBusca(true);

    try {
        const urlSpace = CONFIG_IA.urlHuggingFace || null;

        // Se não tiver URL do Space configurada, vai direto pro fallback local
        if (!urlSpace || urlSpace.trim() === "") {
            throw new Error("URL do HuggingFace Space não configurada.");
        }

        const registrosNuvem = typeof listaFotosDesaparecidos !== 'undefined'
            ? listaFotosDesaparecidos
            : [];

        const respostaIA = await fetch(urlSpace, {
            method: "POST",
            headers: {
                "Authorization": token ? `Bearer ${token}` : "",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                data: [fraseUsuario, JSON.stringify(registrosNuvem)]
            })
        });

        if (!respostaIA.ok) throw new Error(`Space retornou status ${respostaIA.status}`);

        const resultadoGradio = await respostaIA.json();

        // Gradio retorna { data: [...] } — pega o primeiro item
        let dadosFiltrados = resultadoGradio.data;
        if (typeof dadosFiltrados === 'string') {
            dadosFiltrados = JSON.parse(dadosFiltrados);
        } else if (Array.isArray(dadosFiltrados)) {
            dadosFiltrados = typeof dadosFiltrados[0] === 'string'
                ? JSON.parse(dadosFiltrados[0])
                : dadosFiltrados[0];
        }

        if (typeof renderizarFotosFiltradasIA === 'function') {
            renderizarFotosFiltradasIA(dadosFiltrados, true);
        }

    } catch (erro) {
        console.warn("⚠️ Busca IA falhou, usando busca local:", erro.message);

        // ===== FALLBACK LOCAL INTELIGENTE =====
        const lista = typeof listaFotosDesaparecidos !== 'undefined'
            ? listaFotosDesaparecidos
            : [];

        const termos = fraseUsuario.toLowerCase().split(/\s+/).filter(t => t.length > 2);

        const fallbackLocal = lista.filter(item => {
            const campos = [
                item.nome   || '',
                item.cidade || '',
                item.desc   || '',
                String(item.idade || '')
            ].join(' ').toLowerCase();

            // Retorna true se QUALQUER termo bater em QUALQUER campo
            return termos.some(t => campos.includes(t));
        });

        if (typeof renderizarFotosFiltradasIA === 'function') {
            renderizarFotosFiltradasIA(fallbackLocal, true);
        }

    } finally {
        mostrarLoadingBusca(false);
    }
}

// =====================================================================
// FEEDBACK VISUAL DE LOADING NA BARRA DE BUSCA
// =====================================================================
function mostrarLoadingBusca(ativo) {
    const btn = document.getElementById('btn-avancada');
    if (!btn) return;

    if (ativo) {
        btn.dataset.textoOriginal = btn.innerHTML;
        btn.innerHTML = '⏳ Buscando...';
        btn.disabled = true;
        btn.style.opacity = '0.7';
    } else {
        btn.innerHTML = btn.dataset.textoOriginal || '🌐 IA';
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}
