const statusEl = document.getElementById("status");
const transcriptEl = document.getElementById("transcript");
const orb = document.getElementById("orb");
const confirmBox = document.getElementById("confirm");
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let active = false;
let awaitingCommand = false;
let wakeTimer;

function say(text) {
  statusEl.textContent = text;
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "uk-UA";
  utterance.rate = 0.96;
  const voices = window.speechSynthesis.getVoices();
  utterance.voice = voices.find(v => v.lang?.toLowerCase().startsWith("uk")) || null;
  window.speechSynthesis.speak(utterance);
}
function normalize(value) {
  return value.toLocaleLowerCase("uk-UA").replace(/[.,!?]/g, "").trim();
}
async function handleCommand(raw) {
  const command = normalize(raw);
  transcriptEl.textContent = raw;
  if (/^(відкрий|запусти)?\s*(ютуб|youtube)$/.test(command)) {
    await window.sofia.open("youtube"); say("Відкриваю YouTube.");
  } else if (/музик|youtube music/.test(command)) {
    await window.sofia.open("music"); say("Відкриваю музику.");
  } else if (/провідник|папк/.test(command)) {
    await window.sofia.open("explorer"); say("Відкриваю Провідник.");
  } else if (/налаштуванн/.test(command)) {
    await window.sofia.open("settings"); say("Відкриваю налаштування Windows.");
  } else if (/браузер|google/.test(command)) {
    await window.sofia.open("browser"); say("Відкриваю браузер.");
  } else if (/калькулятор/.test(command)) {
    await window.sofia.open("calculator"); say("Відкриваю калькулятор.");
  } else if (/блокнот/.test(command)) {
    await window.sofia.open("notepad"); say("Відкриваю блокнот.");
  } else if (/пошукай|знайди в інтернеті|загугли/.test(command)) {
    const query = raw.replace(/^(софія[, ]*)?(пошукай|знайди в інтернеті|загугли)\s*/i, "").trim();
    if (query) { await window.sofia.search(query); say("Шукаю в інтернеті: " + query); }
    else say("Що саме пошукати?");
  } else if (/котра година|яка година|час/.test(command)) {
    say("Зараз " + new Intl.DateTimeFormat("uk-UA", { hour: "2-digit", minute: "2-digit" }).format(new Date()));
  } else if (/(вимкни|виключи) (комп'ютер|компютер|пк|ноутбук)|заверши роботу|вимкнення комп'ютера/.test(command)) {
    confirmBox.classList.remove("hidden"); say("Підтверди вимкнення комп'ютера на екрані.");
  } else if (/скасуй вимкнення/.test(command)) {
    window.sofia.cancelShutdown(); say("Якщо було заплановане вимкнення, його скасовано.");
  } else if (/дякую/.test(command)) {
    say("Завжди рада допомогти.");
  } else {
    say("Я почула тебе. Цю команду ще не додано.");
  }
}
function startRecognition() {
  if (active) return;
  if (!SpeechRecognition) {
    say("Розпізнавання мовлення недоступне. Ця версія використовує Web Speech API.");
    return;
  }
  active = true;
  recognition = new SpeechRecognition();
  recognition.lang = "uk-UA";
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    const text = event.results[event.results.length - 1][0].transcript.trim();
    const normalized = normalize(text);
    if (awaitingCommand) {
      awaitingCommand = false; clearTimeout(wakeTimer); handleCommand(text);
    } else if (normalized === "софія" || normalized.startsWith("софія ")) {
      const remainder = text.replace(/^софія[, ]*/i, "").trim();
      if (remainder) handleCommand(remainder);
      else {
        awaitingCommand = true; say("Так, я слухаю.");
        wakeTimer = setTimeout(() => { awaitingCommand = false; statusEl.textContent = "Очікую слово «Софія»…"; }, 10000);
      }
    }
  };
  recognition.onerror = (event) => {
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      active = false; statusEl.textContent = "Немає дозволу на мікрофон або сервіс розпізнавання недоступний.";
    }
  };
  recognition.onend = () => {
    if (!active) return;
    // Chromium may reject an immediate restart while its speech service is still shutting down.
    setTimeout(() => {
      if (!active) return;
      try {
        recognition.start();
      } catch {
        active = false;
        startRecognition();
      }
    }, 700);
  };
  try { recognition.start(); statusEl.textContent = "Очікую слово «Софія»…"; orb.style.background = "#8fe0bd"; }
  catch { active = false; say("Не вдалося запустити мікрофон."); }
}
document.getElementById("listen").addEventListener("click", startRecognition);
document.getElementById("stop").addEventListener("click", () => {
  active = false; recognition?.stop(); statusEl.textContent = "Мікрофон на паузі."; orb.style.background = "#a77aff";
});
document.getElementById("minimize").addEventListener("click", () => window.sofia.minimize());
document.getElementById("close").addEventListener("click", () => window.sofia.close());
document.getElementById("shutdown").addEventListener("click", async () => {
  const result = await window.sofia.shutdown();
  confirmBox.classList.add("hidden");
  say(result.ok ? "Комп'ютер вимкнеться через 30 секунд." : result.error);
});
document.getElementById("cancel").addEventListener("click", () => {
  window.sofia.cancelShutdown(); confirmBox.classList.add("hidden"); say("Вимкнення скасовано.");
});
window.addEventListener("DOMContentLoaded", () => {
  // Browser permission must be granted once by the user; thereafter the app resumes listening.
  startRecognition();
});
