// =====================================================================
// DIAMANTE BLACK RASTREADOR — firebase_db.js v1.0
// Motor de banco de dados compartilhado (Firebase Firestore)
// =====================================================================

const firebaseConfig = {
  apiKey: "AIzaSyA_Vl77cpcAoUGue5ZdMOvtRRYbp7-QhkM",
  authDomain: "diamanterastreador-e44ce.firebaseapp.com",
  projectId: "diamanterastreador-e44ce",
  storageBucket: "diamanterastreador-e44ce.firebasestorage.app",
  messagingSenderId: "349541664179",
  appId: "1:349541664179:web:7d974106dcbcf82e7737c6",
  measurementId: "G-4J1TNHECXC"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const COLECAO = "desaparecidos";

const IDB = {
  db: null, STORE: "registros", DB_NAME: "DiamanteBancoDB", VERSION: 1,
  abrir() {
    return new Promise((resolve, reject) => {
      if (this.db) return resolve(this.db);
      const req = indexedDB.open(this.DB_NAME, this.VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.STORE)) db.createObjectStore(this.STORE, { keyPath: "id" });
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
    } catch (e) { return false; }
  },
  async lerTodos() {
    try {
      const db = await this.abrir();
      const tx = db.transaction(this.STORE, "readonly");
      const store = tx.objectStore(this.STORE);
      const req = store.getAll();
      return new Promise((resolve) => { req.onsuccess = () => resolve(req.result || []); req.onerror = () => resolve([]); });    } catch (e) { return []; }
  }
};

async function buscarDadosDoGitHub() {
  try {
    const snapshot = await db.collection(COLECAO).orderBy("id", "desc").get();
    const lista = [];
    snapshot.forEach(doc => lista.push(doc.data()));
    await IDB.salvarTodos(lista);
    console.log(`✅ Firebase: ${lista.length} registros carregados`);
    return lista;
  } catch (erro) {
    console.error("❌ Erro ao buscar do Firebase:", erro);
    return await IDB.lerTodos();
  }
}

async function salvarDadosNoGitHub(listaCompleta) {
  console.log("🕵️ Salvando no Firebase...");
  if (!Array.isArray(listaCompleta)) return false;
  try {
    await IDB.salvarTodos(listaCompleta);
    const snapshot = await db.collection(COLECAO).get();
    const batch = db.batch();
    snapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    
    const batchAdd = db.batch();
    listaCompleta.forEach(item => {
      const ref = db.collection(COLECAO).doc(String(item.id));
      batchAdd.set(ref, item);
    });
    await batchAdd.commit();
    console.log(`✅ Firebase: ${listaCompleta.length} registros salvos`);
    return true;
  } catch (erro) {
    console.error("❌ Erro ao salvar no Firebase:", erro);
    return false;
  }
}

async function deletarRegistroPorId(id) {
  try {
    const snapshot = await db.collection(COLECAO).get();
    const listaAtual = [];
    snapshot.forEach(doc => listaAtual.push(doc.data()));
    const listaAtualizada = listaAtual.filter(item => String(item.id) !== String(id));
    if (listaAtualizada.length === listaAtual.length) return false;
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
    mostrarToast(sucesso ? `✅ Registro ${id} apagado com sucesso!` : `❌ Erro ao apagar.`, sucesso ? 'sucesso' : 'aviso');
  } else {
    alert(sucesso ? `✅ Registro ${id} apagado com sucesso!` : `❌ Erro ao apagar.`);
  }
});

console.log("🔥 Firebase inicializado com sucesso!");
