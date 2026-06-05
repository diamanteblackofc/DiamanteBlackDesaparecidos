// =====================================================================
// DIAMANTE BLACK RASTREADOR — robou.js  v3.0
// Motor do mural: cadastro, renderização, detalhes, status e delete
// =====================================================================

// Lista local em memória (sincronizada com GitHub + IndexedDB)
let listaFotosDesaparecidos = [];

// =====================================================================
// 0. INICIALIZAÇÃO
// =====================================================================
async function inicializarRobo() {
  try {
    const dadosNuvem = await buscarDadosDoGitHub();
    if (Array.isArray(dadosNuvem) && dadosNuvem.length > 0) {
      listaFotosDesaparecidos = dadosNuvem;
    }
  } catch (erro) {
    console.error("❌ Erro ao inicializar:", erro);
  } finally {
    renderizarMural();
    document.dispatchEvent(new CustomEvent('muralCarregado', {
      detail: { total: listaFotosDesaparecidos.length }
    }));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializarRobo);
} else {
  inicializarRobo();
}

// =====================================================================
// 1. EVENTO: NOVO CADASTRO
// =====================================================================
document.addEventListener('novoCadastro', async (e) => {
  const dados = e.detail;
  const inputFoto = dados.fotoEl;
  const arquivo = (inputFoto && inputFoto.files) ? inputFoto.files[0] : null;

  if (!arquivo) {
    alert("Adicione uma foto antes de publicar.");
    return;
  }

  // Comprime imagem antes de salvar (evita base64 gigante)
  const fotoBase64 = await comprimirImagem(arquivo, 800, 0.75);

  const novaFicha = {
    id: Date.now(),
    fotoBase64,
    nome: dados.nome,
    idade: dados.idade || "Não informada",
    cidade: dados.cidade,
    desc: dados.desc || "Sem detalhes adicionais.",
    whatsapp: dados.whats,
    status: "Procurando",
    dataCadastro: new Date().toLocaleDateString('pt-BR')
  };

  listaFotosDesaparecidos.unshift(novaFicha);
  renderizarMural();

  const totalEl = document.getElementById('total-registros');
  if (totalEl) totalEl.textContent = listaFotosDesaparecidos.length;

  // Feedback visual imediato
  mostrarToast("✅ Publicado no mural! Sincronizando...");

  const sucesso = await salvarDadosNoGitHub(listaFotosDesaparecidos);

  if (!sucesso) {
    mostrarToast("⚠️ Salvo localmente. Sincronização pendente.", "aviso");
  } else {
    mostrarToast("✅ Sincronizado com sucesso!", "sucesso");
  }
});

// =====================================================================
// 2. COMPRIMIR IMAGEM (evita base64 enorme que rompe o GitHub)
// =====================================================================
function comprimirImagem(arquivo, maxLargura, qualidade) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(arquivo);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxLargura) {
        height = Math.round((height * maxLargura) / width);
        width = maxLargura;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', qualidade));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// =====================================================================
// 3. RENDERIZAR MURAL
// =====================================================================
function renderizarMural() {
  const mural = document.getElementById("mural");
  if (!mural) return;

  mural.innerHTML = '';

  if (listaFotosDesaparecidos.length === 0) {
    mural.innerHTML = `
      <div id="mural-vazio" style="grid-column:1/-1; text-align:center; padding:60px 20px;">
        <div style="font-size:48px; opacity:0.2;">🔍</div>
        <p style="color:var(--cinza); font-size:14px; letter-spacing:1px; margin-top:16px;">
          Nenhum registro no mural ainda.<br>Seja o primeiro a cadastrar.
        </p>
      </div>`;
    return;
  }

  listaFotosDesaparecidos.forEach(item => {
    const classeTag = item.status === "Achado" ? "achado" : "ativo";
    const textoTag  = item.status === "Achado" ? "Achado 🎉" : "Desaparecido";

    const card = document.createElement('article');
    card.className = 'card-pessoa';
    card.setAttribute('data-id', item.id);
    card.onclick = () => abrirDetalhePorId(item.id);

    card.innerHTML = `
      <img src="${item.fotoBase64}" alt="${escapeHtml(item.nome)}" loading="lazy">
      <div class="overlay"></div>
      <span class="card-tag ${classeTag}">${textoTag}</span>
      <div class="card-info">
        <p class="card-nome">${escapeHtml(item.nome)}</p>
        <p class="card-cidade">${escapeHtml(item.cidade)} · ${escapeHtml(String(item.idade))}</p>
      </div>`;

    mural.appendChild(card);
  });

  const totalEl = document.getElementById('total-registros');
  if (totalEl) totalEl.textContent = listaFotosDesaparecidos.length;
}

// =====================================================================
// 4. ABRIR DETALHE
// =====================================================================
function abrirDetalhePorId(id) {
  const registro = listaFotosDesaparecidos.find(p => String(p.id) === String(id));
  if (!registro) return;

  abrirDetalhe({
    id:     registro.id,
    foto:   registro.fotoBase64,
    nome:   registro.nome,
    cidade: registro.cidade,
    idade:  registro.idade,
    desc:   registro.desc,
    whats:  registro.whatsapp,
    status: registro.status
  });
}

// =====================================================================
// 5. MARCAR COMO ACHADO
// =====================================================================
async function marcarComoAchado(id) {
  const registro = listaFotosDesaparecidos.find(p => String(p.id) === String(id));
  if (!registro) { alert("❌ Registro não encontrado."); return; }

  registro.status = "Achado";
  renderizarMural();

  if (typeof fecharModal === 'function') fecharModal('modal-detalhe');

  mostrarToast("🎉 Marcado como ACHADO! Salvando...");
  const sucesso = await salvarDadosNoGitHub(listaFotosDesaparecidos);

  mostrarToast(
    sucesso
      ? "✅ Status atualizado! Obrigado por usar o Diamante Rastreador."
      : "⚠️ Atualizado localmente. Sincronização pendente.",
    sucesso ? "sucesso" : "aviso"
  );
}

// =====================================================================
// 6. APAGAR PRÓPRIA POSTAGEM (verificação por WhatsApp)
// =====================================================================
async function apagarMinhaPostagem(id) {
  const registro = listaFotosDesaparecidos.find(p => String(p.id) === String(id));
  if (!registro) { alert("Registro não encontrado."); return; }

  const whatsDigitado = prompt(
    `Para confirmar a exclusão de "${registro.nome}",\ndigite o WhatsApp cadastrado na postagem:`
  );
  if (whatsDigitado === null) return;

  const normalizar = s => String(s).replace(/\D/g, '');
  if (normalizar(whatsDigitado) !== normalizar(registro.whatsapp)) {
    alert("❌ WhatsApp incorreto. Só quem criou a postagem pode apagá-la.");
    return;
  }

  if (!confirm(`Apagar a postagem de "${registro.nome}"? Ação irreversível.`)) return;

  listaFotosDesaparecidos = listaFotosDesaparecidos.filter(p => String(p.id) !== String(id));
  renderizarMural();

  if (typeof fecharModal === 'function') fecharModal('modal-detalhe');

  mostrarToast("🗑️ Postagem removida. Salvando...");
  const sucesso = await salvarDadosNoGitHub(listaFotosDesaparecidos);

  mostrarToast(
    sucesso ? "✅ Postagem removida com sucesso." : "⚠️ Removido localmente. Sincronização pendente.",
    sucesso ? "sucesso" : "aviso"
  );
}

// =====================================================================
// 7. COMPARTILHAR POSTAGEM
// =====================================================================
function compartilharPostagem(dados) {
  const texto =
    `🔍 *DIAMANTE RASTREADOR — Pessoa Desaparecida*\n\n` +
    `👤 Nome: ${dados.nome}\n` +
    `📍 Cidade: ${dados.cidade}\n` +
    `🎂 Idade: ${dados.idade || 'Não informada'}\n` +
    `📝 Detalhes: ${dados.desc || 'Sem detalhes'}\n\n` +
    `Se tiver informações, entre em contato:\n` +
    `https://wa.me/55${String(dados.whats || '').replace(/\D/g, '')}`;

  if (navigator.share) {
    navigator.share({
      title: `Pessoa Desaparecida — ${dados.nome}`,
      text: texto,
      url: window.location.href
    }).catch(() => {});
  } else {
    navigator.clipboard.writeText(texto)
      .then(() => alert("📋 Copiado! Cole no WhatsApp ou redes sociais."))
      .catch(() => {
        const urlWhats = `https://wa.me/?text=${encodeURIComponent(texto)}`;
        window.open(urlWhats, '_blank');
      });
  }
}

// =====================================================================
// 8. BUSCA LOCAL (filtro enquanto digita)
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
  const campoBusca = document.getElementById('campo-busca');
  if (campoBusca) {
    campoBusca.addEventListener('input', () => {
      const termo = campoBusca.value.trim().toLowerCase();
      if (!termo) { renderizarMural(); return; }

      const filtrados = listaFotosDesaparecidos.filter(item =>
        (item.nome   || '').toLowerCase().includes(termo) ||
        (item.cidade || '').toLowerCase().includes(termo) ||
        (item.desc   || '').toLowerCase().includes(termo)
      );
      renderizarFotosFiltradasIA(filtrados, false);
    });
  }
});

// =====================================================================
// 9. RENDERIZAR LISTA FILTRADA (chamado por ia_ponte.js também)
// =====================================================================
function renderizarFotosFiltradasIA(listaFiltrada, exibirBotaoVoltar = true) {
  const mural = document.getElementById("mural");
  if (!mural) return;

  const botaoAntigo = document.getElementById("container-limpar-busca");
  if (botaoAntigo) botaoAntigo.remove();

  mural.innerHTML = '';

  if (exibirBotaoVoltar) {
    const botaoHTML = `
      <div id="container-limpar-busca" style="grid-column:1/-1;display:flex;justify-content:center;margin-bottom:12px;">
        <button onclick="restaurarMuralCompleto()"
          style="background:var(--perigo);color:#fff;border:none;padding:10px 20px;
                 border-radius:8px;font-weight:bold;cursor:pointer;letter-spacing:1px;font-size:13px;">
          ✖ Limpar Busca
        </button>
      </div>`;
    mural.insertAdjacentHTML("beforebegin", botaoHTML);
  }

  if (!listaFiltrada || listaFiltrada.length === 0) {
    mural.innerHTML = `
      <div id="mural-vazio" style="grid-column:1/-1;text-align:center;padding:40px 20px;">
        <div style="font-size:36px;opacity:0.3;">🔍</div>
        <p style="color:var(--cinza);margin-top:12px;">Nenhum resultado encontrado.</p>
      </div>`;
    return;
  }

  listaFiltrada.forEach(item => {
    const classeTag = item.status === "Achado" ? "achado" : "ativo";
    const textoTag  = item.status === "Achado" ? "Achado 🎉" : "Desaparecido";

    const card = document.createElement('article');
    card.className = 'card-pessoa';
    card.setAttribute('data-id', item.id);
    card.onclick = () => abrirDetalhePorId(item.id);

    card.innerHTML = `
      <img src="${item.fotoBase64}" alt="${escapeHtml(item.nome)}" loading="lazy">
      <div class="overlay"></div>
      <span class="card-tag ${classeTag}">${textoTag}</span>
      <div class="card-info">
        <p class="card-nome">${escapeHtml(item.nome)}</p>
        <p class="card-cidade">${escapeHtml(item.cidade)} · ${escapeHtml(String(item.idade))}</p>
      </div>`;

    mural.appendChild(card);
  });
}

// =====================================================================
// 10. RESTAURAR MURAL COMPLETO
// =====================================================================
function restaurarMuralCompleto() {
  const botao = document.getElementById("container-limpar-busca");
  if (botao) botao.remove();
  const campo = document.getElementById('campo-busca');
  if (campo) campo.value = '';
  renderizarMural();
}

// =====================================================================
// 11. TOAST — notificações não intrusivas
// =====================================================================
function mostrarToast(msg, tipo = "info") {
  const cores = { info: "#c8a84b", sucesso: "#27ae60", aviso: "#c0392b" };
  let toast = document.getElementById('diamante-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'diamante-toast';
    toast.style.cssText = `
      position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
      background:#0f0f1a; border:1px solid; border-radius:10px;
      padding:12px 22px; font-family:'Rajdhani',sans-serif; font-size:14px;
      font-weight:600; letter-spacing:0.5px; z-index:9999;
      transition:opacity 0.4s; max-width:90vw; text-align:center;
      box-shadow:0 4px 20px rgba(0,0,0,0.6);`;
    document.body.appendChild(toast);
  }
  toast.style.borderColor = cores[tipo] || cores.info;
  toast.style.color = cores[tipo] || cores.info;
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => { toast.style.opacity = '0'; }, 3500);
}

// =====================================================================
// UTILITÁRIO: Escape XSS
// =====================================================================
function escapeHtml(str) {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
