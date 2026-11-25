
export const members = [
  { name: "НічнийВовк", role: "ЛІДЕР", color: "pink", status: "online", hours: "18 год 42 хв" },
  { name: "VioletFox", role: "МОДЕР", color: "cyan", status: "online", hours: "12 год 08 хв" },
  { name: "Shadow", role: "СТАРШИЙ", color: "violet", status: "away", hours: "9 год 31 хв" },
  { name: "Luna", role: "МІСЦЕВИЙ", color: "blue", status: "online", hours: "6 год 14 хв" },
  { name: "Raven", role: "МОЛОДШИЙ", color: "silver", status: "offline", hours: "2 год 05 хв" }
];

export const notices = [
  { title: "Ласкаво просимо до VERCETI", detail: "Це демонстраційна версія закритої спільноти.", time: "Щойно", kind: "purple" },
  { title: "Анкети на перевірці", detail: "Керівництво перевіряє нові заявки.", time: "12 хв тому", kind: "gold" },
  { title: "Тижнева активність", detail: "Статистика активності оновлюється.", time: "1 год тому", kind: "cyan" }
];

export const menu = [
  ["Головна", "⌂", "home"],
  ["Новини", "▤", "news"],
  ["Учасники", "♙", "members"],
  ["Чат", "▤", "chat"],
  ["Голосові кімнати", "◖", "voice"],
  ["Музика", "♫", "music"],
  ["Фото та відео", "▧", "media"],
  ["Правила", "⚖", "rules"],
  ["Тестування", "✧", "tests"],
  ["Анкети", "▣", "forms"],
  ["Рулетка та бонуси", "◇", "rewards"],
  ["Онлайн-активність", "◷", "activity"],
  ["Статистика", "▥", "stats"],
  ["Сповіщення", "♧", "notifications"],
  ["Налаштування", "⚙", "settings"]
] as const;
