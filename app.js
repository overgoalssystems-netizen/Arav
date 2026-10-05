/* ============================================================
   Sarvam Vaani — frontend logic
   Voice-first chat: mic -> live transcription -> Sarvam AI -> spoken reply
   ============================================================ */
(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);

  const state = {
    language: "hi-IN",
    model: "sarvam-105b",
    speaker: "shubh",
    sttMode: "transcribe",
    segLen: 2200,
    autoSpeak: true,
    demo: false,
    ttsLanguages: [],
    messages: [],
    busy: false,
    lastDetected: null,
  };

  const SYSTEM_PROMPT =
    "You are Sarvam Vaani, a warm, helpful voice assistant for users across India. " +
    "Always reply in the same language and script the user wrote in (Hindi, Punjabi, " +
    "Tamil, Bengali, etc.). Keep replies concise and natural for spoken conversation. " +
    "Prefer short paragraphs over long lists.";

  const SUGGESTIONS = [
    "नमस्ते! तुम क्या-क्या कर सकते हो?",
    "ਇੱਕ ਛੋਟੀ ਜਿਹੀ ਕਹਾਣੀ ਸੁਣਾਓ",
    "Translate 'Good morning' into Tamil",
    "मुझे आज का एक अच्छा विचार दो",
  ];

  /* ---------- tiny helpers ---------- */
  const toastEl = $("#toast");
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 4200);
  }
  const scrollBottom = () => {
    const c = $("#chat");
    c.scrollTop = c.scrollHeight;
  };
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = (s) =>
    s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  /* ---------- boot ---------- */
  async function init() {
    try {
      const r = await fetch("/api/config");
      const c = await r.json();
      state.demo = c.demo;
      state.ttsLanguages = c.tts_languages || [];
      state.model = (c.chat_models && c.chat_models[0]) || "sarvam-105b";

      fillSelect($("#langSelect"), c.languages, (l) => `${l.name} · ${l.native}`, "code");
      fillSelect($("#speakerSelect"), c.speakers, (s) => s, null);
      fillSelect($("#modelSelect"), c.chat_models, (m) => m, null);

      $("#langSelect").value = state.language;
      $("#speakerSelect").value = state.speaker;
      $("#modelSelect").value = state.model;
    } catch (e) {
      toast("Could not reach the backend. Is the server running?");
    }
    renderWelcome();
    if (state.demo) setTimeout(() => toast("Demo mode — add your Sarvam API key in backend/.env"), 800);
  }

  function fillSelect(sel, items, labelFn, valueKey) {
    sel.innerHTML = "";
    items.forEach((it) => {
      const o = document.createElement("option");
      o.value = valueKey ? it[valueKey] : it;
      o.textContent = labelFn(it);
      sel.appendChild(o);
    });
  }

  function renderWelcome() {
    const chat = $("#chat");
    chat.innerHTML = "";
    const w = el("div", "welcome");
    w.innerHTML = `
      <div class="orb-big"></div>
      <h2>बोलिए, और मैं समझ जाऊँगा</h2>
      <p>Tap the mic and speak in any Indian language — your words appear live, and I answer in your language. Or just type below.</p>
      <div class="chips"></div>`;
    const chips = w.querySelector(".chips");
    SUGGESTIONS.forEach((s) => {
      const c = el("button", "chip", esc(s));
      c.onclick = () => {
        $("#input").value = s;
        autoGrow();
        send();
      };
      chips.appendChild(c);
    });
    chat.appendChild(w);
  }

  /* ---------- message rendering ---------- */
  function clearWelcome() {
    const w = $("#chat").querySelector(".welcome");
    if (w) w.remove();
  }

  function addMessage(role, text) {
    clearWelcome();
    const wrap = el("div", "msg " + (role === "user" ? "user" : "ai"));
    const avatar = el("div", "avatar", role === "user" ? "🧑" : "🪔");
    const body = el("div");
    const bubble = el("div", "bubble", esc(text || ""));
    const meta = el("div", "meta", new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    body.appendChild(bubble);
    body.appendChild(meta);
    wrap.appendChild(avatar);
    wrap.appendChild(body);
    $("#chat").appendChild(wrap);
    scrollBottom();
    return { wrap, bubble, meta };
  }

  /* ---------- sending ---------- */
  async function send() {
    if (state.busy) return;
    const input = $("#input");
    const text = input.value.trim();
    if (!text) return;

    state.messages.push({ role: "user", content: text });
    addMessage("user", text);
    input.value = "";
    autoGrow();
    await askAI();
  }

  async function askAI() {
    state.busy = true;
    setBusy(true);

    const { bubble } = addMessage("ai", "");
    bubble.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    let answer = "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: state.model,
          stream: true,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...state.messages],
        }),
      });

      if (!res.ok || !res.body) throw new Error("HTTP " + res.status);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let first = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const raw = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 2);
          if (!raw.startsWith("data:")) continue;
          const data = raw.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const j = JSON.parse(data);
            if (j.error) throw new Error(j.error);
            const delta = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
            if (delta) {
              if (first) {
                bubble.innerHTML = "";
                first = false;
              }
              answer += delta;
              bubble.innerHTML = esc(answer) + '<span class="cursor"></span>';
              scrollBottom();
            }
          } catch (e) {
            /* ignore partial json */
          }
        }
      }

      bubble.innerHTML = esc(answer) || "(no reply)";
      if (answer) {
        state.messages.push({ role: "assistant", content: answer });
        speak(answer);
      }
    } catch (err) {
      bubble.innerHTML = '<span style="color:#ff8aa8">⚠️ ' + esc(String(err.message || err)) + "</span>";
    } finally {
      state.busy = false;
      setBusy(false);
      scrollBottom();
    }
  }

  function setBusy(b) {
    $("#send").disabled = b;
    $("#mic").style.pointerEvents = b ? "none" : "auto";
    $("#mic").style.opacity = b ? ".5" : "1";
  }

  /* ---------- text to speech ---------- */
  let currentAudio = null;
  function ttsLang() {
    if (state.language === "auto") return state.lastDetected || "hi-IN";
    return state.language;
  }
  async function speak(text) {
    if (!state.autoSpeak || state.demo) return;
    const lang = ttsLang();
    if (!state.ttsLanguages.includes(lang)) return; // Bulbul can't voice this language
    try {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 2400), language_code: lang, speaker: state.speaker }),
      });
      const j = await r.json();
      for (const b64 of j.audios || []) await playB64(b64);
    } catch (e) {
      /* silent — voice is a bonus, not critical */
    }
  }
  function playB64(b64) {
    return new Promise((resolve) => {
      if (currentAudio) {
        try { currentAudio.pause(); } catch (e) {}
      }
      const a = new Audio("data:audio/wav;base64," + b64);
      currentAudio = a;
      a.onended = resolve;
      a.onerror = resolve;
      a.play().catch(resolve);
    });
  }

  /* ---------- voice input: segmented live transcription ---------- */
  let mediaStream = null, recorder = null, chunks = [], segTimer = null;
  let listening = false, liveText = "";

  function pickMime() {
    const opts = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg", "audio/mp4"];
    for (const m of opts) if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m;
    return "";
  }

  async function startListening() {
    if (listening || state.busy) return;
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch (e) {
      toast("Microphone permission is needed to speak.");
      return;
    }
    listening = true;
    liveText = $("#input").value ? $("#input").value + " " : "";
    $("#livebar").classList.remove("hidden");
    $("#mic").classList.add("rec");
    setLive("Listening…", true);
    recordSegment();
  }

  function recordSegment() {
    if (!listening) return;
    chunks = [];
    const mime = pickMime();
    recorder = new MediaRecorder(mediaStream, mime ? { mimeType: mime } : undefined);
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = async () => {
      const type = recorder.mimeType || "audio/webm";
      const blob = new Blob(chunks, { type });
      if (blob.size > 1500) await transcribe(blob);
      if (listening) recordSegment();
    };
    recorder.start();
    segTimer = setTimeout(() => { try { recorder.stop(); } catch (e) {} }, state.segLen);
  }

  async function transcribe(blob) {
    const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "mp4" : "webm";
    const fd = new FormData();
    fd.append("file", blob, "segment." + ext);
    fd.append("language_code", state.language);
    fd.append("mode", state.sttMode);
    try {
      const r = await fetch("/api/stt", { method: "POST", body: fd });
      const j = await r.json();
      if (j.language_code) state.lastDetected = j.language_code;
      const t = (j.transcript || "").trim();
      if (t) {
        liveText = (liveText + " " + t).replace(/\s+/g, " ").trim();
        $("#input").value = liveText;
        autoGrow();
        setLive(liveText, false);
        scrollBottom();
      }
    } catch (e) {
      /* keep listening even if one segment fails */
    }
  }

  function setLive(text, ghost) {
    $("#liveText").innerHTML = ghost ? '<span class="ghost">' + esc(text) + "</span>" : esc(text);
  }

  function stopListening() {
    listening = false;
    clearTimeout(segTimer);
    try { if (recorder && recorder.state !== "inactive") recorder.stop(); } catch (e) {}
    if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
    $("#livebar").classList.add("hidden");
    $("#mic").classList.remove("rec");
  }

  /* ---------- textarea autogrow ---------- */
  function autoGrow() {
    const t = $("#input");
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 140) + "px";
  }

  /* ---------- wiring ---------- */
  function wire() {
    $("#send").onclick = () => { if (listening) stopListening(); send(); };

    $("#input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    });
    $("#input").addEventListener("input", autoGrow);

    $("#mic").onclick = () => (listening ? stopListening() : startListening());
    $("#liveStop").onclick = stopListening;

    $("#langSelect").onchange = (e) => (state.language = e.target.value);
    $("#speakerSelect").onchange = (e) => (state.speaker = e.target.value);
    $("#modelSelect").onchange = (e) => (state.model = e.target.value);
    $("#sttMode").onchange = (e) => (state.sttMode = e.target.value);

    $("#segLen").oninput = (e) => {
      state.segLen = Number(e.target.value);
      $("#segLenVal").textContent = (state.segLen / 1000).toFixed(1) + "s";
    };

    const toggle = $("#speakToggle");
    toggle.onclick = () => {
      state.autoSpeak = !state.autoSpeak;
      toggle.classList.toggle("active", state.autoSpeak);
      toggle.classList.toggle("off", !state.autoSpeak);
      toggle.querySelector(".ico").textContent = state.autoSpeak ? "🔊" : "🔇";
      toast(state.autoSpeak ? "Spoken replies on" : "Spoken replies off");
    };

    $("#settingsBtn").onclick = openDrawer;
    $("#closeDrawer").onclick = closeDrawer;
    $("#scrim").onclick = closeDrawer;
    $("#clearBtn").onclick = () => {
      state.messages = [];
      renderWelcome();
      closeDrawer();
      toast("Chat cleared");
    };

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { closeDrawer(); if (listening) stopListening(); }
    });
  }

  function openDrawer() { $("#drawer").classList.add("open"); $("#scrim").classList.add("show"); }
  function closeDrawer() { $("#drawer").classList.remove("open"); $("#scrim").classList.remove("show"); }

  wire();
  init();
})();
