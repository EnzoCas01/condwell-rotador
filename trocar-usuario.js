(function () {
  var API = "https://api.condwell.com.br";
  var SESSION_KEY = "rf.session";
  var BOOT_KEY = "rf.boot-cache";
  var VPS_KEY = "cw.vpsUrl";

  function getSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function usuarioAtual() {
    try {
      var raw = localStorage.getItem(BOOT_KEY);
      if (!raw) return null;
      var cache = JSON.parse(raw);
      var lists = cache && Array.isArray(cache.playlists) ? cache.playlists : [];
      for (var i = 0; i < lists.length; i++) {
        if (lists[i] && lists[i].ativa) return lists[i].username;
      }
      return lists.length ? lists[0].username : null;
    } catch (e) {
      return null;
    }
  }

  function api(path, method, body, session) {
    var headers = { accept: "application/json" };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (session) {
      headers["x-device-id"] = session.device_id;
      headers["x-device-key"] = session.device_key;
    }
    return fetch(API + path, {
      method: method,
      headers: headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    }).then(function (r) {
      return r.json().then(function (d) {
        if (d && d.status === "ok") return d.dados !== undefined ? d.dados : d;
        throw new Error((d && d.mensagem) || "Erro " + r.status);
      });
    });
  }

  function validarCredenciais(serverUrl, username, password) {
    var u = serverUrl.replace(/\/+$/, "") +
      "/player_api.php?username=" + encodeURIComponent(username) +
      "&password=" + encodeURIComponent(password);
    return fetch(u)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        return d && d.user_info && d.user_info.status === "Active";
      })
      .catch(function () { return false; });
  }

  var css = document.createElement("style");
  css.textContent = [
    "#cwtrocar{position:fixed;right:16px;bottom:16px;z-index:999999;display:flex;align-items:center;gap:8px;background:#7c3aed;color:#fff;border:none;border-radius:24px;padding:12px 18px;font:600 15px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.45)}",
    "#cwtrocar:hover{background:#8b5cf6}",
    "#cwoverlay{position:fixed;inset:0;z-index:999998;background:rgba(0,0,0,.65);display:none;align-items:center;justify-content:center}",
    "#cwoverlay.cwaberta{display:flex}",
    "#cwbox{background:#0b0512;border:1px solid #ffffff22;border-radius:16px;padding:24px;width:min(380px,92vw);color:#fff;font:15px/1.4 system-ui,sans-serif;box-shadow:0 16px 48px rgba(0,0,0,.6);max-height:90vh;overflow:auto}",
    "#cwbox h2{margin:0 0 4px;font-size:18px}",
    "#cwbox h3{margin:22px 0 6px;font-size:14px;color:#a78bfa}",
    "#cwbox p{margin:0 0 16px;color:#a78bfa;font-size:13px}",
    "#cwbox label{display:block;margin:12px 0 4px;color:#ccc;font-size:13px}",
    "#cwbox input,#cwbox textarea{width:100%;box-sizing:border-box;background:#171021;border:1px solid #ffffff22;border-radius:10px;padding:10px 12px;color:#fff;font-size:15px;outline:none;font-family:system-ui,sans-serif}",
    "#cwbox input:focus,#cwbox textarea:focus{border-color:#7c3aed}",
    "#cwbox textarea{resize:vertical;font-size:12px}",
    "#cwbtn{width:100%;margin-top:20px;background:#7c3aed;color:#fff;border:none;border-radius:10px;padding:12px;font:600 15px system-ui,sans-serif;cursor:pointer}",
    "#cwbtn:hover{background:#8b5cf6}",
    "#cwbtn:disabled{opacity:.6;cursor:wait}",
    "#cwsmall{width:100%;margin-top:8px;background:#171021;color:#ccc;border:1px solid #ffffff22;border-radius:10px;padding:8px;font:13px system-ui,sans-serif;cursor:pointer}",
    "#cwsmall:hover{background:#241a33}",
    "#cwstatus{margin:12px 0 0;color:#fca5a5;font-size:13px;min-height:18px}",
    "#cwstatus.cwok{color:#4ade80}",
    "#cwvpsstatus{margin:6px 0 0;color:#888;font-size:12px;min-height:15px;word-break:break-all}",
    "#cwfechar{margin-top:10px;width:100%;background:transparent;color:#888;border:none;padding:8px;font:13px system-ui,sans-serif;cursor:pointer}",
    "#cwfechar:hover{color:#fff}"
  ].join("\n");
  document.head.appendChild(css);

  var btn = document.createElement("button");
  btn.id = "cwtrocar";
  btn.textContent = "Trocar usuário";
  document.body.appendChild(btn);

  var overlay = document.createElement("div");
  overlay.id = "cwoverlay";
  overlay.innerHTML = [
    '<div id="cwbox">',
    "<h2>Trocar usuário</h2>",
    '<p id="cwatual"></p>',

    "<h3>Troca manual</h3>",
    '<label for="cwcodigo">Código</label>',
    '<input id="cwcodigo" type="text" autocomplete="off" placeholder="ABCD1234">',
    '<label for="cwuser">Novo usuário</label>',
    '<input id="cwuser" type="text" autocomplete="off" placeholder="Digite o usuário">',
    '<label for="cwpass">Nova senha</label>',
    '<input id="cwpass" type="password" autocomplete="off" placeholder="Digite a senha">',
    '<button id="cwbtn">Atualizar</button>',
    '<div id="cwstatus"></div>',

    "<h3>Troca automática (VPS)</h3>",
    '<label for="cwvpsurl">Endereço da VPS</label>',
    '<input id="cwvpsurl" type="text" autocomplete="off" placeholder="http://IP_DA_VPS:3030">',
    '<button id="cwvpsbtn">Salvar VPS</button>',
    '<div id="cwvpsstatus"></div>',

    "<h3>Sessão do aparelho (para o config.json)</h3>",
    '<textarea id="cwsession" rows="2" readonly></textarea>',
    '<button id="cwsessioncopy">Copiar</button>',

    '<button id="cwfechar">Fechar</button>',
    "</div>"
  ].join("");
  document.body.appendChild(overlay);

  function abrir() {
    var atual = usuarioAtual();
    document.getElementById("cwatual").textContent = atual
      ? "Usuário atual: " + atual
      : "Usuário atual: —";
    document.getElementById("cwstatus").textContent = "";
    document.getElementById("cwstatus").className = "";
    var session = getSession();
    document.getElementById("cwsession").value = session
      ? JSON.stringify({ device_id: session.device_id, device_key: session.device_key })
      : "Nenhuma sessão ativa.";
    var vps = null;
    try { vps = localStorage.getItem(VPS_KEY); } catch (e) {}
    document.getElementById("cwvpsurl").value = vps || "";
    overlay.classList.add("cwaberta");
    document.getElementById("cwcodigo").focus();
  }

  function fechar() {
    overlay.classList.remove("cwaberta");
  }

  function status(msg, ok) {
    var el = document.getElementById("cwstatus");
    el.textContent = msg;
    el.className = ok ? "cwok" : "";
  }

  function atualizar() {
    var code = document.getElementById("cwcodigo").value.trim().toUpperCase();
    var user = document.getElementById("cwuser").value.trim();
    var pass = document.getElementById("cwpass").value.trim();
    var session = getSession();
    var btnAtualizar = document.getElementById("cwbtn");

    if (!session || !session.device_id) {
      status("Nenhuma sessão ativa encontrada. Ative o aparelho primeiro.");
      return;
    }
    if (!code) {
      status("Digite o código.");
      return;
    }

    btnAtualizar.disabled = true;
    status("Conectando...");

    api("/v1/device/code/resolve", "POST", { code: code }, session)
      .then(function (r) {
        var serverUrl = r && r.dns && r.dns.server_url;
        var temp = r && r.tipo === "temp";
        if (temp) return { temp: true, serverUrl: null };
        if (!user || !pass) throw new Error("Digite usuário e senha.");
        if (!serverUrl) throw new Error("Código inválido.");
        status("Validando usuário e senha...");
        return validarCredenciais(serverUrl, user, pass).then(function (ok) {
          if (!ok) throw new Error("Usuário ou senha inválidos.");
          status("Conectando lista...");
          return api("/v1/device/playlists", "POST", {
            nome: user.slice(0, 20),
            username: user,
            password: pass,
            server_url: serverUrl,
            ativar: true
          }, session).then(function () {
            return { temp: false, user: user };
          });
        });
      })
      .then(function (res) {
        status("Saindo da sessão anterior...");
        return api("/v1/device/playlists", "GET", undefined, session)
          .then(function (lists) {
            var paraRemover = [];
            for (var i = 0; i < lists.length; i++) {
              var item = lists[i];
              if (!item) continue;
              var remover = res.temp ? !item.ativa : item.username !== res.user;
              if (remover) paraRemover.push(item.id);
            }
            if (paraRemover.length === lists.length && lists.length > 0) {
              paraRemover = [];
            }
            return Promise.all(paraRemover.map(function (id) {
              return api("/v1/device/playlists/" + id, "DELETE", undefined, session).catch(function () {});
            }));
          })
          .catch(function () {})
          .then(function () {
            try { localStorage.removeItem(BOOT_KEY); } catch (e) {}
            status("Trocado! Recarregando...", true);
            setTimeout(function () { location.reload(); }, 900);
          });
      })
      .catch(function (e) {
        status("Erro: " + e.message);
        btnAtualizar.disabled = false;
      });
  }

  function salvarVps() {
    var url = document.getElementById("cwvpsurl").value.trim().replace(/\/+$/, "");
    var el = document.getElementById("cwvpsstatus");
    if (!url) {
      try { localStorage.removeItem(VPS_KEY); } catch (e) {}
      el.textContent = "VPS removida. Modo automático desligado.";
      return;
    }
    if (!/^https?:\/\//.test(url)) {
      el.textContent = "Coloque http:// ou https:// no endereço.";
      return;
    }
    try { localStorage.setItem(VPS_KEY, url); } catch (e) {}
    el.textContent = "VPS salva: " + url;
    verificarVps();
  }

  function verificarVps() {
    var url = null;
    try { url = localStorage.getItem(VPS_KEY); } catch (e) {}
    var el = document.getElementById("cwvpsstatus");
    if (!url) return;
    fetch(url + "/status")
      .then(function (r) { return r.json(); })
      .then(function (s) {
        var pageLoad = 0;
        try { pageLoad = Number(sessionStorage.getItem("cwPageLoadAt")) || 0; } catch (e) {}
        var auto = false;
        try { auto = sessionStorage.getItem("cwAutoReload") === "1"; } catch (e) {}
        if (s && s.ultimaTroca && s.ultimaTroca > pageLoad && !auto) {
          try { sessionStorage.setItem("cwAutoReload", "1"); } catch (e) {}
          location.reload();
          return;
        }
        if (s && s.ultimaTroca) {
          var mins = Math.round((s.proximaTroca - Date.now()) / 60000);
          el.textContent = "VPS: usuário " + (s.usuarioAtual || "—") + " · próxima troca em " + mins + " min";
        } else {
          el.textContent = "VPS conectada.";
        }
      })
      .catch(function () {
        el.textContent = "VPS não respondeu em " + url;
      });
  }

  function copiarSessao() {
    var ta = document.getElementById("cwsession");
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e) {}
    if (!ok && navigator.clipboard) {
      navigator.clipboard.writeText(ta.value).catch(function () {});
    }
  }

  btn.addEventListener("click", abrir);
  document.getElementById("cwfechar").addEventListener("click", fechar);
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) fechar();
  });
  document.getElementById("cwbtn").addEventListener("click", atualizar);
  document.getElementById("cwvpsbtn").addEventListener("click", salvarVps);
  document.getElementById("cwsessioncopy").addEventListener("click", copiarSessao);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") fechar();
  });

  try {
    var auto = sessionStorage.getItem("cwAutoReload") === "1";
    if (auto) sessionStorage.removeItem("cwAutoReload");
    if (auto || !sessionStorage.getItem("cwPageLoadAt")) {
      sessionStorage.setItem("cwPageLoadAt", String(Date.now()));
    }
  } catch (e) {}

  function poll() {
    var url = null;
    try { url = localStorage.getItem(VPS_KEY); } catch (e) {}
    if (url) verificarVps();
    setTimeout(poll, 60000);
  }
  setTimeout(poll, 8000);
})();
