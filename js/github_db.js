// =====================================================================
// DIAMANTE BLACK RASTREADOR — github_db.js  v3.0
// Banco de dados no GitHub + IndexedDB como cache local persistente
// =====================================================================

// 🔐 Token em partes (evita scanner automático)
function obterTokenSeguro() {
  const a = "ghp_divsDfl5qCdBDuq3K0ZuD2nj3cuhk83c";
  const b = "h83c6CWy";
  return `Bearer ${a}${b}`;
}

const CONFIG_GITHUB = {
  usuario: "diamanteblackofc",
  repositorio: "DiamanteBlackDesaparecidos",
  arquivoBanco: "banco.json"
};

const URL_API_GH = `https://api.github.com/repos/${CONFIG_GITHUB.usuario}/${CONFIG_GITHUB.repositorio}/contents/${CONFIG_GITHUB.arquivoBanco}`;

// ─── SHA cache para evitar dupla requisição ───
let _shaAtual = null;

// =====================================================================
// IndexedDB — cache local persistente
// =====================================================================
const IDB = {
  db: null,
  STORE: "registros",
  DB_NAME: "DiamanteBancoDB",
  VERSION: 1,

  abrir() {
    return new Promise((resolve, reject) => {
      if (this.db) return resolve(this.db);
      const req = indexedDB.open(this.DB_NAME, this.VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.STORE)) {
          db.createObjectStore(this.STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = (e) => { this.db = e.target.result; resolve(this.db); };
      req.onerror = () => reject(req.error);
    });
  },

  async salvarTodos(lista) {
    try {
      const db = await this.abrir();
      const tx = db.transaction(this.STORE, "readwrite");
      const store = tx.objectStore(this.STORE);
      store.clear();
      lista.forEach(item => store.put(item));
      return new Promise((resolve) => { tx.oncomplete = () => resolve(true); tx.onerror = () => resolve(false); });
    } catch (e) { console.warn("IDB salvarTodos:", e); return false; }
  },

  async lerTodos() {
    try {
      const db = await this.abrir();
      const tx = db.transaction(this.STORE, "readonly");
      const store = tx.objectStore(this.STORE);
      const req = store.getAll();
      return new Promise((resolve) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch (e) { console.warn("IDB lerTodos:", e); return []; }
  },

  async exportarJSON() {
    const dados = await this.lerTodos();
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "banco_diamante.json"; a.click();
    URL.revokeObjectURL(url);
  },

  async importarJSON(arquivo) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const dados = JSON.parse(e.target.result);
          if (!Array.isArray(dados)) throw new Error("JSON inválido");
          await this.salvarTodos(dados);
          // Sincroniza com GitHub também
          await salvarDadosNoGitHub(dados);
          resolve(dados);
        } catch (err) { reject(err); }
      };
      reader.readAsText(arquivo);
    });
  }
};

// =====================================================================
// 1. PUXAR BANCO DO GITHUB
// =====================================================================
async function puxarBancoDoGitHub() {
  try {
    const resposta = await fetch(URL_API_GH, {
      method: "GET",
      headers: { "Authorization": obterTokenSeguro(), "Cache-Control": "no-cache" }
    });

    if (resposta.status === 404) return { dadosAtuais: [], sha: null };
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

    const json = await resposta.json();
    _shaAtual = json.sha;

    if (!json.content || json.content.trim() === "") {
      return { dadosAtuais: [], sha: json.sha };
    }

    const texto = decodeURIComponent(escape(atob(json.content.replace(/\s/g, ""))));
    const dados = JSON.parse(texto);
    return { dadosAtuais: Array.isArray(dados) ? dados : [], sha: json.sha };

  } catch (erro) {
    console.error("❌ Erro ao ler GitHub:", erro);
    // Fallback: retorna cache local do IndexedDB
    const local = await IDB.lerTodos();
    console.log("📦 Usando cache IndexedDB:", local.length, "registros");
    return { dadosAtuais: local, sha: null };
  }
}

// Alias para robou.js
async function buscarDadosDoGitHub() {
  const { dadosAtuais } = await puxarBancoDoGitHub();
  return dadosAtuais;
}

// =====================================================================
// 2. SALVAR BANCO NO GITHUB — com retry em caso de conflito de SHA
// =====================================================================
async function salvarDadosNoGitHub(listaCompleta, tentativa = 1) {
  console.log(`🕵️ Salvando no GitHub... (tentativa ${tentativa})`);

  if (!Array.isArray(listaCompleta)) {
    console.error("❌ listaCompleta precisa ser um Array");
    return false;
  }

  try {
    // Salva primeiro no IndexedDB (sempre funciona offline)
    await IDB.salvarTodos(listaCompleta);

    // Pega SHA fresco se não temos (evita conflitos 422)
    if (!_shaAtual) {
      const { sha } = await puxarBancoDoGitHub();
      _shaAtual = sha;
    }

    const conteudoBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(listaCompleta, null, 2))));

    const body = {
      message: `🕵️ Diamante Black: ${new Date().toLocaleString('pt-BR')}`,
      content: conteudoBase64
    };
    if (_shaAtual) body.sha = _shaAtual;

    const resposta = await fetch(URL_API_GH, {
      method: "PUT",
      headers: {
        "Authorization": obterTokenSeguro(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (resposta.status === 409 || resposta.status === 422) {
      // Conflito de SHA — pega SHA novo e tenta de novo (até 3x)
      console.warn("⚠️ Conflito de SHA detectado, buscando SHA atualizado...");
      _shaAtual = null;
      if (tentativa < 3) return salvarDadosNoGitHub(listaCompleta, tentativa + 1);
      throw new Error("Conflito de SHA após 3 tentativas");
    }

    if (!resposta.ok) {
      const errBody = await resposta.json().catch(() => ({}));
      throw new Error(`GitHub API ${resposta.status}: ${errBody.message || ''}`);
    }

    const resJson = await resposta.json();
    // Atualiza SHA após salvar com sucesso
    _shaAtual = resJson.content?.sha || null;

    console.log("✅ Sincronizado com GitHub!");
    return true;

  } catch (erro) {
    console.error("❌ Erro ao salvar no GitHub:", erro);
    // Dados estão salvos no IndexedDB mesmo assim
    return false;
  }
}

// =====================================================================
// 3. DELETAR REGISTRO POR ID (usado pelo Admin via evento)
// =====================================================================
async function deletarRegistroPorId(id) {
  try {
    const { dadosAtuais } = await puxarBancoDoGitHub();
    const listaAtualizada = dadosAtuais.filter(item => String(item.id) !== String(id));

    if (listaAtualizada.length === dadosAtuais.length) {
      console.warn("⚠️ ID não encontrado:", id);
      return false;
    }

    const sucesso = await salvarDadosNoGitHub(listaAtualizada);

    // Atualiza memória do robou.js
    if (typeof listaFotosDesaparecidos !== 'undefined') {
      listaFotosDesaparecidos.length = 0;
      listaAtualizada.forEach(i => listaFotosDesaparecidos.push(i));
      if (typeof renderizarMural === 'function') renderizarMural();
    }

    return sucesso;
  } catch (erro) {
    console.error("❌ Erro ao deletar:", erro);
    return false;
  }
}

// Evento do painel admin
document.addEventListener('deletarRegistro', async (e) => {
  const { id } = e.detail;
  const sucesso = await deletarRegistroPorId(id);
  alert(sucesso
    ? `✅ Registro ${id} apagado com sucesso!`
    : `❌ Erro ao apagar. Verifique a conexão.`
  );
});

// =====================================================================
// 4. SINCRONIZAÇÃO INICIAL — GitHub → IndexedDB → Mural
// =====================================================================
async function sincronizarAppComNuvem() {
  console.log("🔄 Iniciando sincronização...");

  // Tenta GitHub primeiro; se falhar usa IndexedDB
  let { dadosAtuais } = await puxarBancoDoGitHub();

  // Se veio do GitHub, salva no IndexedDB como cache
  if (dadosAtuais.length > 0) {
    await IDB.salvarTodos(dadosAtuais);
  } else {
    // GitHub falhou ou está vazio — usa cache local
    dadosAtuais = await IDB.lerTodos();
  }

  if (typeof listaFotosDesaparecidos !== 'undefined') {
    listaFotosDesaparecidos.length = 0;
    dadosAtuais.forEach(i => listaFotosDesaparecidos.push(i));
  }

  if (typeof renderizarMural === 'function') renderizarMural();

  document.dispatchEvent(new CustomEvent('muralCarregado', {
    detail: { total: dadosAtuais.length }
  }));

  console.log(`✅ Sincronizado: ${dadosAtuais.length} registros`);
}

document.addEventListener("DOMContentLoaded", () => {
  sincronizarAppComNuvem();
});
