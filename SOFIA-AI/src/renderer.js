const statusEl = document.getElementById("status");
const transcriptEl = document.getElementById("transcript");
const orb = document.getElementById("orb");
const confirmBox = document.getElementById("confirm");
let awaitingCommand = false;
let listening = true;
let wakeTimer;
const conversation = [];
let aiReady = false;
let speaking = false;
let speechFinishedAt = 0;

function say(text) {
  statusEl.textContent = text;
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "uk-UA";
  utterance.rate = 0.96;
  const voices = window.speechSynthesis.getVoices();
  utterance.voice = voices.find(v => v.lang?.toLowerCase().startsWith("uk")) || null;
  speaking = true;
  utterance.onend = () => { speaking = false; speechFinishedAt = Date.now(); };
  utterance.onerror = () => { speaking = false; speechFinishedAt = Date.now(); };
  window.speechSynthesis.speak(utterance);
}

function normalize(value) {
  return value.toLocaleLowerCase("uk-UA").replace(/[.,!?;:]/g, " ").replace(/\s+/g, " ").trim();
}

async function openTarget(target, response) {
  const result = await window.sofia.open(target);
  say(result?.ok ? response : (result?.error || "Не вдалося виконати команду."));
}

async function handleCommand(raw) {
  const command = normalize(raw);
  transcriptEl.textContent = raw;
  if (/^(відкрий |запусти )?(ютуб|youtube)$/.test(command)) {
    await openTarget("youtube", "Відкриваю YouTube.");
  } else if (/музик|youtube music/.test(command)) {
    await openTarget("music", "Відкриваю YouTube Music.");
  } else if (/провідник|папк/.test(command)) {
    await openTarget("explorer", "Відкриваю Провідник.");
  } else if (/налаштуванн/.test(command)) {
    await openTarget("settings", "Відкриваю налаштування Windows.");
  } else if (/браузер|google/.test(command)) {
    await openTarget("browser", "Відкриваю браузер.");
  } else if (/калькулятор/.test(command)) {
    await openTarget("calculator", "Відкриваю калькулятор.");
  } else if (/блокнот/.test(command)) {
    await openTarget("notepad", "Відкриваю Блокнот.");
  } else if (/пошукай|знайди в інтернеті|загугли/.test(command)) {
    const query = raw.replace(/^(пошукай|знайди в інтернеті|загугли)\s*/i, "").trim();
    if (query) {
      const result = await window.sofia.search(query);
      say(result?.ok ? "Шукаю в інтернеті: " + query : (result?.error || "Не вдалося виконати пошук."));
    } else say("Що саме пошукати?");
  } else if (/котра година|яка година|час/.test(command)) {
    say("Зараз " + new Intl.DateTimeFormat("uk-UA", { hour: "2-digit", minute: "2-digit" }).format(new Date()));
  } else if (/(вимкни|виключи) (комп'ютер|компютер|пк|ноутбук)|заверши роботу|вимкнення комп'ютера/.test(command)) {
    confirmBox.classList.remove("hidden");
    say("Підтверди вимкнення комп'ютера на екрані.");
  } else if (/скасуй вимкнення/.test(command)) {
    const result = await window.sofia.cancelShutdown();
    say(result.ok ? "Вимкнення скасовано." : result.error);
  } else if (/^(увімкни )?(ігровий режим|режим гри)$/.test(command)) {
    say("Ігровий режим увімкнено. Ховаю аватар.");
    setTimeout(() => window.sofia.hideForGame(), 1200);
  } else if (/^(вимкни )?(ігровий режим|режим гри)$/.test(command)) {
    window.sofia.show();
    say("Ігровий режим вимкнено. Я знову на екрані.");
  } else if (/^(покажи|відкрий) (мене|софію)$/.test(command)) {
    window.sofia.show();
    say("Я знову на екрані.");
  } else if (/дякую/.test(command)) {
    say("Завжди рада допомогти.");
  } else {
    await askAssistant(raw);
  }
}


async function askAssistant(message) {
  if (!aiReady) await refreshAiStatus();
  if (!aiReady) {
    say("Для розмови зі мною запусти локальний Ollama та встанови модель Qwen 2.5 на цьому комп'ютері. Аудіо й текст залишаються локально.");
    return;
  }
  say("Дай мені секунду подумати.");
  const result = await window.sofia.chat({ message, history: conversation });
  if (!result.ok) {
    say(result.error || "Зараз не можу відповісти. Спробуй ще раз.");
    return;
  }
  conversation.push({ role: "user", content: message });
  conversation.push({ role: "assistant", content: result.answer });
  if (conversation.length > 20) conversation.splice(0, conversation.length - 20);
  say(result.answer);
}

async function refreshAiStatus() {
  const result = await window.sofia.aiStatus();
  aiReady = Boolean(result.ok);
  const aiStatus = document.getElementById("ai-status");
  if (aiStatus) {
    aiStatus.textContent = aiReady
      ? "Локальний ШІ підключено · " + result.model
      : "ШІ офлайн · " + (result.error || "Ollama не готовий");
    aiStatus.classList.toggle("ready", aiReady);
  }
}

function processRecognizedPhrase(raw) {
  const phrase = normalize(raw);
  transcriptEl.textContent = raw;
  if (speaking || Date.now() - speechFinishedAt < 900) return;
  if (awaitingCommand) {
    awaitingCommand = false;
    clearTimeout(wakeTimer);
    handleCommand(raw);
    return;
  }
  const wakeIndex = phrase.indexOf("софія");
  if (wakeIndex < 0) return;
  const match = raw.match(/софія[\s,]*/i);
  const remainder = match ? raw.slice(match.index + match[0].length).trim() : "";
  if (remainder) {
    handleCommand(remainder);
  } else {
    awaitingCommand = true;
    say("Так, я слухаю.");
    wakeTimer = setTimeout(() => {
      awaitingCommand = false;
      statusEl.textContent = listening ? "Очікую слово «Софія»…" : "Мікрофон на паузі.";
    }, 10000);
  }
}

window.sofia.onVoiceText(processRecognizedPhrase);
window.sofia.onVoiceStatus((state) => {
  if (state?.message) statusEl.textContent = state.message;
  if (state?.active) {
    listening = true;
    orb.style.background = "#8fe0bd";
    document.getElementById("stop").textContent = "Пауза";
  }
});
window.sofia.onVoiceError((error) => {
  if (error?.message) statusEl.textContent = error.message;
  orb.style.background = "#d89a67";
});

document.getElementById("stop").addEventListener("click", async () => {
  const desired = !listening;
  const result = await window.sofia.setListening(desired);
  if (!result.ok) {
    say(result.error || "Не вдалося змінити стан мікрофона.");
    return;
  }
  listening = desired;
  document.getElementById("stop").textContent = listening ? "Пауза" : "Продовжити";
  statusEl.textContent = listening ? "Запускаю локальне розпізнавання…" : "Мікрофон на паузі.";
  orb.style.background = listening ? "#8fe0bd" : "#a77aff";
});

document.getElementById("minimize").addEventListener("click", () => window.sofia.minimize());
document.getElementById("close").addEventListener("click", () => window.sofia.close());
document.getElementById("shutdown").addEventListener("click", async () => {
  const result = await window.sofia.shutdown();
  confirmBox.classList.add("hidden");
  say(result.ok ? "Комп'ютер вимкнеться через 30 секунд." : result.error);
});
document.getElementById("cancel").addEventListener("click", async () => {
  const result = await window.sofia.cancelShutdown();
  confirmBox.classList.add("hidden");
  say(result.ok ? "Вимкнення скасовано." : result.error);
});

statusEl.textContent = "Запускаю локальне українське розпізнавання…";

document.getElementById("send-chat").addEventListener("click", async () => {
  const field = document.getElementById("chat-input");
  const message = field.value.trim();
  if (!message) return;
  field.value = "";
  transcriptEl.textContent = "Ти: " + message;
  await askAssistant(message);
});
document.getElementById("chat-input").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    document.getElementById("send-chat").click();
  }
});
refreshAiStatus();
