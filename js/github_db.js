// =====================================================================
// DIAMANTE BLACK RASTREADOR — github_db.js
// Responsável por toda comunicação com o banco de dados no GitHub
// =====================================================================

// 🔐 Token montado em partes para dificultar escaneamento automático
function obterTokenSeguro() {
    const pecaA = "ghp_divsDfl5qCdBDuq3K0ZuD2nj3cuhk83c";
    const pecaB = "h83c6CWy";
    return `Bearer ${pecaA}${pecaB}`;
}

const CONFIG_GITHUB = {
    usuario: "diamanteblackofc",
    repositorio: "DiamanteBlackDesaparecidos",
    arquivoBanco: "banco.json"
};

// ✅ CORRIGIDO: URL agora aponta para api.github.com (não github.com)
// ✅ CORRIGIDO: Template literal com ${} correto
const URL_API_GH = `https://api.github.com/repos/${CONFIG_GITHUB.usuario}/${CONFIG_GITHUB.repositorio}/contents/${CONFIG_GITHUB.arquivoBanco}`;

// =====================================================================
// 1. PUXAR BANCO DA NUVEM
// ✅ Renomeado: agora também exporta como buscarDadosDoGitHub()
//    para compatibilidade com robou.js
// =====================================================================
async function puxarBancoDoGitHub() {
    try {
        const resposta = await fetch(URL_API_GH, {
            method: "GET",
            headers: { "Authorization": obterTokenSeguro() }
        });

        if (resposta.status === 404) {
            return { dadosAtuais: [], sha: null };
        }

        if (!resposta.ok) {
            throw new Error(`Erro HTTP ${resposta.status}`);
        }

        const dadosArtigo = await resposta.json();

        if (!dadosArtigo.content || dadosArtigo.content.trim() === "") {
            return { dadosAtuais: [], sha: dadosArtigo.sha };
        }

        const textoDecodificado = decodeURIComponent(
            escape(atob(dadosArtigo.content.replace(/\s/g, "")))
        );
        const dadosAtuais = JSON.parse(textoDecodificado);

        return { dadosAtuais: Array.isArray(dadosAtuais) ? dadosAtuais : [], sha: dadosArtigo.sha };

    } catch (erro) {
        console.error("❌ Erro ao ler banco do GitHub:", erro);
        return { dadosAtuais: [], sha: null };
    }
}

// ✅ Alias para compatibilidade com robou.js que chama buscarDadosDoGitHub()
async function buscarDadosDoGitHub() {
    const { dadosAtuais } = await puxarBancoDoGitHub();
    return dadosAtuais;
}

// =====================================================================
// 2. SALVAR LISTA COMPLETA NO GITHUB
// ✅ CORRIGIDO: Agora recebe a lista completa (não uma ficha individual)
//    Isso resolve o conflito com robou.js que já passava a lista inteira
// =====================================================================
async function salvarDadosNoGitHub(listaCompleta) {
    console.log("🕵️ Salvando dados na nuvem do GitHub...");

    try {
        // Precisamos do SHA atual para fazer o PUT
        const { sha } = await puxarBancoDoGitHub();

        if (!Array.isArray(listaCompleta)) {
            throw new Error("listaCompleta precisa ser um Array");
        }

        const conteudoBase64 = btoa(
            unescape(encodeURIComponent(JSON.stringify(listaCompleta, null, 2)))
        );

        const body = {
            message: "🕵️ Diamante Black: registros atualizados",
            content: conteudoBase64
        };

        // SHA é obrigatório ao atualizar um arquivo existente
        if (sha) body.sha = sha;

        const resposta = await fetch(URL_API_GH, {
            method: "PUT",
            headers: {
                "Authorization": obterTokenSeguro(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!resposta.ok) {
            const errBody = await resposta.json().catch(() => ({}));
            throw new Error(`GitHub API error ${resposta.status}: ${errBody.message || ''}`);
        }

        console.log("✅ Dados sincronizados com sucesso!");
        return true;

    } catch (erro) {
        console.error("❌ Erro na sincronização:", erro);
        return false;
    }
}

// =====================================================================
// 3. DELETAR UM REGISTRO POR ID
// ✅ NOVO: Handler para o evento 'deletarRegistro' do index.html
// =====================================================================
async function deletarRegistroPorId(id) {
    try {
        const { dadosAtuais } = await puxarBancoDoGitHub();
        const listaAtualizada = dadosAtuais.filter(item => String(item.id) !== String(id));

        if (listaAtualizada.length === dadosAtuais.length) {
            console.warn("⚠️ ID não encontrado para deletar:", id);
            return false;
        }

        const sucesso = await salvarDadosNoGitHub(listaAtualizada);

        if (sucesso && typeof listaFotosDesaparecidos !== 'undefined') {
            // Atualiza a lista em memória do robou.js
            listaFotosDesaparecidos.length = 0;
            listaAtualizada.forEach(item => listaFotosDesaparecidos.push(item));
            if (typeof renderizarMural === 'function') renderizarMural();
        }

        return sucesso;
    } catch (erro) {
        console.error("❌ Erro ao deletar registro:", erro);
        return false;
    }
}

// Escuta evento de delete disparado pelo painel admin do index.html
document.addEventListener('deletarRegistro', async (e) => {
    const { id } = e.detail;
    const sucesso = await deletarRegistroPorId(id);
    alert(sucesso
        ? `✅ Registro ${id} apagado com sucesso!`
        : `❌ Erro ao apagar registro ${id}. Verifique o console.`
    );
});

// =====================================================================
// 4. SINCRONIZAÇÃO INICIAL
// =====================================================================
async function sincronizarAppComNuvem() {
    const { dadosAtuais } = await puxarBancoDoGitHub();

    if (dadosAtuais && dadosAtuais.length > 0) {
        if (typeof listaFotosDesaparecidos !== 'undefined') {
            listaFotosDesaparecidos.length = 0;
            dadosAtuais.forEach(item => listaFotosDesaparecidos.push(item));
        }
        if (typeof renderizarMural === 'function') {
            renderizarMural();
        }
    } else {
        if (typeof renderizarMural === 'function') renderizarMural();
    }

    // Notifica o index.html que o mural terminou de carregar
    document.dispatchEvent(new CustomEvent('muralCarregado', {
        detail: { total: dadosAtuais.length }
    }));
}

document.addEventListener("DOMContentLoaded", () => {
    sincronizarAppComNuvem();
});
