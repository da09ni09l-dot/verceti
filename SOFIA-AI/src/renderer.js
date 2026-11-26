const statusEl = document.getElementById("status");
const transcriptEl = document.getElementById("transcript");
const orb = document.getElementById("orb");
const confirmBox = document.getElementById("confirm");
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let active = false;
let awaitingCommand = false;
let wakeTimer;
let restartTimer;

function say(text) {
  statusEl.textContent = text;
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "uk-UA";
  utterance.rate = 0.96;
  const voices = window.speechSynthesis.getVoices();
  utterance.voice = voices.find(v => v.lang?.toLowerCase().startsWith("uk")) || voices.find(v => v.lang?.startsWith("ru")) || null;
  window.speechSynthesis.speak(utterance);
}

function normalize(value) {
  return value.toLocaleLowerCase("uk-UA").replace(/[.,!?]/g, "").trim();
}

async function handleCommand(raw) {
  const command = normalize(raw);
  transcriptEl.textContent = raw;
  if (/ютуб|youtube/.test(command)) {
    await window.sofia.open("youtube");
    say("Відкриваю YouTube.");
  } else if (/музик/.test(command)) {
    await window.sofia.open("music");
    say("Відкриваю музику.");
  } else if (/котра година|яка година|час/.test(command)) {
    say("Зараз " + new Intl.DateTimeFormat("uk-UA", { hour: "2-digit", minute: "2-digit" }).format(new Date()));
  } else if (/вимкни|виключи|заверши роботу/.test(command)) {
    confirmBox.classList.remove("hidden");
    say("Підтверди вимкнення комп'ютера на екрані.");
  } else if (/скасуй|скасувати|відміни/.test(command)) {
    window.sofia.cancelShutdown();
    confirmBox.classList.add("hidden");
    say("Якщо вимкнення було заплановане, я його скасувала.");
  } else if (/дякую/.test(command)) {
    say("Завжди рада допомогти.");
  } else {
    say("Я почула тебе. Цю команду ще потрібно додати.");
  }
}

function startRecognition() {
  if (active) return;
  if (!SpeechRecognition) {
    say("У цьому середовищі немає підтримки розпізнавання голосу. Потрібен сумісний сервіс розпізнавання.");
    return;
  }
  clearTimeout(restartTimer);
  recognition = new SpeechRecognition();
  recognition.lang = "uk-UA";
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    const result = event.results[event.results.length - 1];
    if (!result.isFinal) return;
    const text = result[0].transcript.trim();
    const normalized = normalize(text);
    transcriptEl.textContent = text;
    if (awaitingCommand) {
      awaitingCommand = false;
      clearTimeout(wakeTimer);
      handleCommand(text);
    } else if (normalized === "софія" || normalized.startsWith("софія ")) {
      const remainder = text.replace(/^софія\s*[,.:;!?-]?\s*/i, "");
      if (remainder) handleCommand(remainder);
      else {
        awaitingCommand = true;
        say("Так, я тут. Слухаю тебе.");
        wakeTimer = setTimeout(() => {
          awaitingCommand = false;
          statusEl.textContent = "Очікую слово «Софія»…";
        }, 10000);
      }
    }
  };
  recognition.onerror = (event) => {
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      active = false;
      statusEl.textContent = "Немає доступу до мікрофона або сервісу розпізнавання. Перевір дозволи.";
      orb.style.background = "#bd6680";
    }
  };
  recognition.onend = () => {
    if (active) restartTimer = setTimeout(() => {
      try { recognition.start(); } catch { restartTimer = setTimeout(startRecognition, 1200); }
    }, 350);
  };
  active = true;
  try {
    recognition.start();
    statusEl.textContent = "Очікую слово «Софія»…";
    orb.style.background = "#8fe0bd";
  } catch {
    active = false;
    statusEl.textContent = "Не вдалося запустити мікрофон. Натисни «Увімкнути мікрофон».";
  }
}

function stopRecognition() {
  active = false;
  clearTimeout(restartTimer);
  clearTimeout(wakeTimer);
  recognition?.stop();
  statusEl.textContent = "Мікрофон на паузі.";
  orb.style.background = "#a77aff";
}

document.getElementById("listen").addEventListener("click", startRecognition);
document.getElementById("stop").addEventListener("click", stopRecognition);
document.getElementById("minimize").addEventListener("click", () => window.sofia.minimize());
document.getElementById("close").addEventListener("click", () => window.sofia.close());
document.getElementById("shutdown").addEventListener("click", async () => {
  const result = await window.sofia.shutdown();
  confirmBox.classList.add("hidden");
  say(result.ok ? "Комп'ютер вимкнеться через 30 секунд." : result.error);
});
document.getElementById("cancel").addEventListener("click", () => {
  window.sofia.cancelShutdown();
  confirmBox.classList.add("hidden");
  say("Вимкнення скасовано.");
});

// Start listening on launch; the microphone permission prompt may appear the first time.
window.addEventListener("DOMContentLoaded", () => setTimeout(startRecognition, 900));
