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
  } else if (/дякую/.test(command)) {
    say("Завжди рада допомогти.");
  } else {
    say("Я почула тебе. Поки що цю команду ще не додали.");
  }
}

function startRecognition() {
  if (!SpeechRecognition) {
    say("У цьому середовищі немає підтримки розпізнавання голосу. Спробуй актуальну збірку Windows.");
    return;
  }
  recognition = new SpeechRecognition();
  recognition.lang = "uk-UA";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = (event) => {
    const result = event.results[event.results.length - 1];
    const text = result[0].transcript;
    if (result.isFinal) {
      const normalized = normalize(text);
      if (awaitingCommand) {
        awaitingCommand = false;
        clearTimeout(wakeTimer);
        handleCommand(text);
      } else if (normalized === "софія" || normalized.startsWith("софія ")) {
        const remainder = text.trim().replace(/^софія[,s]*/i, "");
        if (remainder) handleCommand(remainder);
        else {
          awaitingCommand = true;
          say("Так, я слухаю.");
          wakeTimer = setTimeout(() => { awaitingCommand = false; statusEl.textContent = "Я тут. Скажи «Софія»"; }, 9000);
        }
      }
    }
  };
  recognition.onerror = (event) => {
    if (event.error === "not-allowed") {
      active = false;
      statusEl.textContent = "Надай дозвіл на мікрофон у налаштуваннях Windows.";
    }
  };
  recognition.onend = () => {
    if (active) {
      try { recognition.start(); } catch {}
    }
  };
  active = true;
  try { recognition.start(); } catch { active = false; }
  statusEl.textContent = "Очікую слово «Софія»…";
  orb.style.background = "#8fe0bd";
}

document.getElementById("listen").addEventListener("click", startRecognition);
document.getElementById("stop").addEventListener("click", () => {
  active = false;
  recognition?.stop();
  statusEl.textContent = "Мікрофон на паузі.";
  orb.style.background = "#a77aff";
});
document.getElementById("minimize").addEventListener("click", () => window.sofia.minimize());
document.getElementById("close").addEventListener("click", () => window.sofia.close());
document.getElementById("shutdown").addEventListener("click", async () => {
  const result = await window.sofia.shutdown();
  confirmBox.classList.add("hidden");
  say(result.ok ? "Комп'ютер вимкнеться через 30 секунд. Скажи скасувати, якщо передумав." : result.error);
});
document.getElementById("cancel").addEventListener("click", () => {
  window.sofia.cancelShutdown();
  confirmBox.classList.add("hidden");
  say("Вимкнення скасовано.");
});
