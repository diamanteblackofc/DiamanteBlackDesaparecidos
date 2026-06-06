const CONFIG_GITHUB = {
  usuario: "diamanteblackofc",
  repositorio: "DiamanteBlackDesaparecidos",
  arquivoBanco: "banco.json"
};

const URL_API_GH = `https://api.github.com/repos/${CONFIG_GITHUB.usuario}/${CONFIG_GITHUB.repositorio}/contents/${CONFIG_GITHUB.arquivoBanco}`;

let _shaAtual = null;

function obterTokenGitHub() {
  const tokenSalvo = localStorage.getItem('diamante_github_token');
  if (!tokenSalvo) {
    console.warn('⚠️ Token GitHub não configurado. Configure no painel Admin.');
    return null;
  }
  try {
    return `Bearer ${atob(tokenSalvo)}`;
  } catch (e) {
    console.error('❌ Erro ao decodificar token:', e);
    return null;
  }
}

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
      
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      
      req.onerror = () => reject(req.error);
    });  },
  
  async salvarTodos(lista) {
    try {
      const db = await this.abrir();
      const tx = db.transaction(this.STORE, "readwrite");
      const store = tx.objectStore(this.STORE);
      store.clear();
      lista.forEach(item => store.put(item));
      
      return new Promise((resolve) => {
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      console.warn("IDB salvarTodos:", e);
      return false;
    }
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
    } catch (e) {
      console.warn("IDB lerTodos:", e);
      return [];
    }
  },
  
  async exportarJSON() {
    const dados = await this.lerTodos();
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "banco_diamante.json";
    a.click();
    URL.revokeObjectURL(url);
  },
  
  async importarJSON(arquivo) {
    return new Promise((resolve, reject) => {      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const dados = JSON.parse(e.target.result);
          if (!Array.isArray(dados)) throw new Error("JSON inválido");
          
          await this.salvarTodos(dados);
          await salvarDadosNoGitHub(dados);
          resolve(dados);
        } catch (err) {
          reject(err);
        }
      };
      
      reader.readAsText(arquivo);
    });
  }
};

async function puxarBancoDoGitHub() {
  const token = obterTokenGitHub();
  
  if (!token) {
    console.warn('⚠️ Token não configurado, usando cache local');
    const local = await IDB.lerTodos();
    return { dadosAtuais: local, sha: null };
  }
  
  try {
    const resposta = await fetch(URL_API_GH, {
      method: "GET",
      headers: {
        "Authorization": token,
        "Cache-Control": "no-cache"
      }
    });
    
    if (resposta.status === 404) return { dadosAtuais: [], sha: null };
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    
    const json = await resposta.json();
    _shaAtual = json.sha;
    
    if (!json.content || json.content.trim() === "") {
      return { dadosAtuais: [], sha: json.sha };
    }
    
    const binaryString = atob(json.content.replace(/\s/g, ""));
    const bytes = new Uint8Array(binaryString.length);    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const texto = new TextDecoder().decode(bytes);
    
    const dados = JSON.parse(texto);
    return { dadosAtuais: Array.isArray(dados) ? dados : [], sha: json.sha };
  } catch (erro) {
    console.error("❌ Erro ao ler GitHub:", erro);
    const local = await IDB.lerTodos();
    console.log("📦 Usando cache IndexedDB:", local.length, "registros");
    return { dadosAtuais: local, sha: null };
  }
}

async function buscarDadosDoGitHub() {
  const { dadosAtuais } = await puxarBancoDoGitHub();
  return dadosAtuais;
}

async function salvarDadosNoGitHub(listaCompleta, tentativa = 1) {
  console.log(`🕵️ Salvando no GitHub... (tentativa ${tentativa})`);
  
  if (!Array.isArray(listaCompleta)) {
    console.error("❌ listaCompleta precisa ser um Array");
    return false;
  }
  
  const token = obterTokenGitHub();
  if (!token) {
    console.warn('⚠️ Token não configurado, salvando apenas localmente');
    await IDB.salvarTodos(listaCompleta);
    return false;
  }
  
  try {
    await IDB.salvarTodos(listaCompleta);
    
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
        "Authorization": token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    
    if (resposta.status === 409 || resposta.status === 422) {
      console.warn("⚠️ Conflito de SHA detectado, buscando SHA atualizado...");
      _shaAtual = null;
      
      if (tentativa < 3) {
        return salvarDadosNoGitHub(listaCompleta, tentativa + 1);
      }
      
      throw new Error("Conflito de SHA após 3 tentativas");
    }
    
    if (!resposta.ok) {
      const errBody = await resposta.json().catch(() => ({}));
      throw new Error(`GitHub API ${resposta.status}: ${errBody.message || ''}`);
    }
    
    const resJson = await resposta.json();
    _shaAtual = resJson.content?.sha || null;
    
    console.log("✅ Sincronizado com GitHub!");
    return true;
  } catch (erro) {
    console.error("❌ Erro ao salvar no GitHub:", erro);
    return false;
  }
}

async function deletarRegistroPorId(id) {
  try {
    const { dadosAtuais } = await puxarBancoDoGitHub();
    const listaAtualizada = dadosAtuais.filter(item => String(item.id) !== String(id));
    
    if (listaAtualizada.length === dadosAtuais.length) {
      console.warn("⚠️ ID não encontrado:", id);
      return false;
    }
    
    const sucesso = await salvarDadosNoGitHub(listaAtualizada);
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

document.addEventListener('deletarRegistro', async (e) => {
  const { id } = e.detail;
  const sucesso = await deletarRegistroPorId(id);
  
  if (typeof mostrarToast === 'function') {
    mostrarToast(
      sucesso ? `✅ Registro ${id} apagado com sucesso!` : `❌ Erro ao apagar. Verifique a conexão.`,
      sucesso ? 'sucesso' : 'aviso'
    );
  } else {
    alert(sucesso ? `✅ Registro ${id} apagado com sucesso!` : `❌ Erro ao apagar. Verifique a conexão.`);
  }
});
