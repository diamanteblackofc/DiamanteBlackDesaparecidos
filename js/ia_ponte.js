// =====================================================================
// DIAMANTE BLACK RASTREADOR — ia_ponte.js  v3.0
// Busca avançada: OpenRouter (navegador web) + HuggingFace Space (local)
// =====================================================================

// Config da IA — preenchida pelo painel Admin
const CONFIG_IA = {
  openRouterKey:  "",   // Chave da OpenRouter (busca web/IA avançada)
  urlHuggingFace: "",   // URL do Space HuggingFace (busca local no banco)
  hfToken:        ""    // Token HuggingFace (opcional)
};

// =====================================================================
// RECEBE EVENTO DO index.html (botão 🌐 IA)
// =====================================================================
document.addEventListener('buscaAvancada', async (e) => {
  const { query, openRouterKey, hfToken, hfUrl } = e.detail;

  // Atualiza config com valores do Admin (passados pelo evento)
  if (openRouterKey) CONFIG_IA.openRouterKey = openRouterKey;
  if (hfToken)       CONFIG_IA.hfToken        = hfToken;
  if (hfUrl)         CONFIG_IA.urlHuggingFace  = hfUrl;

  await processarBuscaInteligente(query);
});

// =====================================================================
// CÉREBRO DA BUSCA — Tenta OpenRouter → HuggingFace → Fallback local
// =====================================================================
async function processarBuscaInteligente(fraseUsuario) {
  console.log("🕵️ DIAMANTE_IA analisando:", fraseUsuario);
  mostrarLoadingBusca(true);

  try {
    const lista = typeof listaFotosDesaparecidos !== 'undefined'
      ? listaFotosDesaparecidos : [];

    // ─── ESTRATÉGIA 1: OpenRouter (pesquisa inteligente com LLM) ───
    if (CONFIG_IA.openRouterKey && CONFIG_IA.openRouterKey.trim() !== "") {
      console.log("🌐 Usando OpenRouter...");
      const resultado = await buscarViaOpenRouter(fraseUsuario, lista);
      if (resultado !== null) {
        renderizarFotosFiltradasIA(resultado, true);
        return;
      }
    }

    // ─── ESTRATÉGIA 2: HuggingFace Space ───
    if (CONFIG_IA.urlHuggingFace && CONFIG_IA.urlHuggingFace.trim() !== "") {
      console.log("🤗 Usando HuggingFace Space...");
      const resultado = await buscarViaHuggingFace(fraseUsuario, lista);
      if (resultado !== null) {
        renderizarFotosFiltradasIA(resultado, true);
        return;
      }
    }

    // ─── ESTRATÉGIA 3: Fallback local inteligente ───
    throw new Error("Nenhuma API configurada, usando busca local.");

  } catch (erro) {
    console.warn("⚠️ Usando busca local:", erro.message);
    const resultado = buscarLocal(fraseUsuario);
    renderizarFotosFiltradasIA(resultado, true);
  } finally {
    mostrarLoadingBusca(false);
  }
}

// =====================================================================
// ESTRATÉGIA 1: OpenRouter — pesquisa inteligente com LLM
// Modelo gratuito: mistralai/mistral-7b-instruct:free
// =====================================================================
async function buscarViaOpenRouter(frase, lista) {
  try {
    // Manda só id + nome + cidade + desc (sem foto base64 — evita context gigante)
    const resumo = lista.map(({ id, nome, cidade, desc, idade, status }) =>
      ({ id, nome, cidade, desc, idade, status })
    );

    const prompt = `
Você é um assistente de busca de pessoas desaparecidas.
Analise a lista de registros abaixo e retorne APENAS um array JSON com os registros que combinam com a consulta do usuário.
Responda SOMENTE com o array JSON, sem texto extra, sem markdown, sem blocos de código.

Consulta do usuário: "${frase}"

Registros disponíveis:
${JSON.stringify(resumo)}

Responda APENAS com o array JSON dos IDs encontrados, exemplo: [12345, 67890]
Se não encontrar nada, responda: []
`;

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

    // Parse seguro
    const idsStr = texto.replace(/```json|```/g, '').trim();
    const ids = JSON.parse(idsStr);

    if (!Array.isArray(ids)) return null;

    // Filtra a lista completa pelos IDs retornados (com fotoBase64)
    const encontrados = lista.filter(item =>
      ids.map(String).includes(String(item.id))
    );

    console.log(`✅ OpenRouter: ${encontrados.length} resultado(s)`);
    return encontrados;

  } catch (erro) {
    console.warn("❌ OpenRouter falhou:", erro.message);
    return null;
  }
}

// =====================================================================
// ESTRATÉGIA 2: HuggingFace Space (busca no banco local do Space)
// =====================================================================
async function buscarViaHuggingFace(frase, lista) {
  try {
    const resposta = await fetch(CONFIG_IA.urlHuggingFace, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(CONFIG_IA.hfToken ? { "Authorization": `Bearer ${CONFIG_IA.hfToken}` } : {})
      },
      body: JSON.stringify({
        data: [frase, JSON.stringify(
          lista.map(({ id, nome, cidade, desc, idade, status }) =>
            ({ id, nome, cidade, desc, idade, status })
          )
        )]
      })
    });

    if (!resposta.ok) {
      console.warn("HuggingFace status:", resposta.status);
      return null;
    }

    const resultado = await resposta.json();
    let dados = resultado.data;

    if (typeof dados === 'string') dados = JSON.parse(dados);
    else if (Array.isArray(dados)) {
      dados = typeof dados[0] === 'string' ? JSON.parse(dados[0]) : dados[0];
    }

    // Se retornou apenas IDs, filtra a lista completa
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

// =====================================================================
// ESTRATÉGIA 3: Busca local inteligente (sempre funciona)
// =====================================================================
function buscarLocal(frase) {
  const lista = typeof listaFotosDesaparecidos !== 'undefined'
    ? listaFotosDesaparecidos : [];

  // Termos com mais de 2 chars
  const termos = frase.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  if (termos.length === 0) return lista;

  return lista.filter(item => {
    const campos = [
      item.nome   || '',
      item.cidade || '',
      item.desc   || '',
      String(item.idade || '')
    ].join(' ').toLowerCase();

    return termos.some(t => campos.includes(t));
  });
}

// =====================================================================
// FEEDBACK VISUAL DE LOADING
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
