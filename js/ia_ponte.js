// =====================================================================
// DIAMANTE BLACK RASTREADOR — ia_ponte.js v3.1 (Corrigido)
// Busca avançada: OpenRouter + HuggingFace + Fallback local
// =====================================================================

const CONFIG_IA = {
  openRouterKey: "",
  urlHuggingFace: "",
  hfToken: ""
};

document.addEventListener('buscaAvancada', async (e) => {
  const { query, openRouterKey, hfToken, hfUrl } = e.detail;
  if (openRouterKey) CONFIG_IA.openRouterKey = openRouterKey;
  if (hfToken) CONFIG_IA.hfToken = hfToken;
  if (hfUrl) CONFIG_IA.urlHuggingFace = hfUrl;
  
  await processarBuscaInteligente(query);
});

async function processarBuscaInteligente(fraseUsuario) {
  console.log("🕵️ DIAMANTE_IA analisando:", fraseUsuario);
  mostrarLoadingBusca(true);
  
  try {
    const lista = typeof listaFotosDesaparecidos !== 'undefined' ? listaFotosDesaparecidos : [];
    
    // ESTRATÉGIA 1: OpenRouter
    if (CONFIG_IA.openRouterKey && CONFIG_IA.openRouterKey.trim() !== "") {
      console.log("🌐 Usando OpenRouter...");
      const resultado = await buscarViaOpenRouter(fraseUsuario, lista);
      if (resultado !== null) {
        renderizarFotosFiltradasIA(resultado, true);
        return;
      }
    }
    
    // ESTRATÉGIA 2: HuggingFace Space
    if (CONFIG_IA.urlHuggingFace && CONFIG_IA.urlHuggingFace.trim() !== "") {
      console.log("🤗 Usando HuggingFace Space...");
      const resultado = await buscarViaHuggingFace(fraseUsuario, lista);
      if (resultado !== null) {
        renderizarFotosFiltradasIA(resultado, true);
        return;
      }
    }
    
    throw new Error("Nenhuma API configurada, usando busca local.");
  } catch (erro) {
    console.warn("⚠️ Usando busca local:", erro.message);    const resultado = buscarLocal(fraseUsuario);
    renderizarFotosFiltradasIA(resultado, true);
  } finally {
    mostrarLoadingBusca(false);
  }
}

async function buscarViaOpenRouter(frase, lista) {
  try {
    const resumo = lista.map(({ id, nome, cidade, desc, idade, status }) => ({ id, nome, cidade, desc, idade, status }));
    
    const prompt = `Você é um assistente de busca de pessoas desaparecidas. Analise a lista de registros abaixo e retorne APENAS um array JSON com os IDs dos registros que combinam com a consulta do usuário. Responda SOMENTE com o array JSON, sem texto extra, sem markdown. Consulta: "${frase}". Registros: ${JSON.stringify(resumo)}. Exemplo de resposta: [12345, 67890] ou []`;
    
    const resposta = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CONFIG_IA.openRouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.href,
        "X-Title": "Diamante Rastreador"
      },
      body: JSON.stringify({
        model: "mistralai/mistral-7b-instruct:free",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.1
      })
    });
    
    if (!resposta.ok) {
      console.warn("OpenRouter status:", resposta.status);
      return null;
    }
    
    const json = await resposta.json();
    const texto = json.choices?.[0]?.message?.content?.trim() || "[]";
    
    // CORREÇÃO: Regex seguro para extrair o array JSON mesmo com formatação estranha
    const match = texto.match(/\[[\s\S]*\]/);
    if (!match) return null;
    
    const ids = JSON.parse(match[0]);
    if (!Array.isArray(ids)) return null;
    
    const encontrados = lista.filter(item => ids.map(String).includes(String(item.id)));
    console.log(`✅ OpenRouter: ${encontrados.length} resultado(s)`);
    return encontrados;
  } catch (erro) {
    console.warn("❌ OpenRouter falhou:", erro.message);
    return null;  }
}

async function buscarViaHuggingFace(frase, lista) {
  try {
    const resposta = await fetch(CONFIG_IA.urlHuggingFace, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(CONFIG_IA.hfToken ? { "Authorization": `Bearer ${CONFIG_IA.hfToken}` } : {})
      },
      body: JSON.stringify({
        data: [frase, JSON.stringify(lista.map(({ id, nome, cidade, desc, idade, status }) => ({ id, nome, cidade, desc, idade, status })))]
      })
    });
    
    if (!resposta.ok) return null;
    
    const resultado = await resposta.json();
    let dados = resultado.data;
    
    if (typeof dados === 'string') dados = JSON.parse(dados);
    else if (Array.isArray(dados)) {
      dados = typeof dados[0] === 'string' ? JSON.parse(dados[0]) : dados[0];
    }
    
    if (Array.isArray(dados) && dados.length > 0 && typeof dados[0] !== 'object') {
      dados = lista.filter(item => dados.map(String).includes(String(item.id)));
    }
    
    console.log(`✅ HuggingFace: ${dados.length} resultado(s)`);
    return Array.isArray(dados) ? dados : null;
  } catch (erro) {
    console.warn("❌ HuggingFace falhou:", erro.message);
    return null;
  }
}

function buscarLocal(frase) {
  const lista = typeof listaFotosDesaparecidos !== 'undefined' ? listaFotosDesaparecidos : [];
  const termos = frase.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  
  if (termos.length === 0) return lista;
  
  return lista.filter(item => {
    const campos = [item.nome || '', item.cidade || '', item.desc || '', String(item.idade || '')].join(' ').toLowerCase();
    return termos.some(t => campos.includes(t));
  });
}
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
