# VERCETI — перша основа

Приватна спільнота з темним фіолетовим неоновим оформленням. Цей пакет — **початковий UI-макет**, а не завершений production-сайт.

## Що вже є
- Next.js + TypeScript.
- Адаптивна головна панель VERCETI.
- Навігація та демонстраційні сторінки розділів.
- Кольори ролей: Адмін — помаранчевий, Лідер — рожевий, Модератор — блакитний, Старший — фіолетовий, Місцевий — синій, Молодший — сріблястий.
- Сторінка входу, підготовлена для Supabase Auth.
- Початкова SQL-схема профілів, анкет, історії ролей та дисциплінарних записів.

## 1. Встановити програми
1. Node.js LTS: https://nodejs.org/
2. Visual Studio Code: https://code.visualstudio.com/
3. Git: https://git-scm.com/downloads
4. GitHub акаунт: https://github.com/

## 2. Запуск локального макета
Розпакуйте ZIP, відкрийте папку `verceti` у VS Code. У терміналі виконайте:

```bash
npm install
cp .env.example .env.local
npm run dev
```

На Windows PowerShell, якщо `cp` не працює:

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

Відкрийте http://localhost:3000

Локальний демо-режим дозволений лише поза production. Він потрібен, щоб спочатку переглянути дизайн без налаштування бази даних. Демодані вигадані.

## 3. GitHub
1. На GitHub натисніть **New repository**.
2. Назва: `verceti`.
3. Виберіть **Private**.
4. Не додавайте README автоматично (він уже є в проєкті).
5. У терміналі з папки проєкту:

```bash
git init
git add .
git commit -m "Initial VERCETI foundation"
git branch -M main
git remote add origin https://github.com/ВАШ_АКАУНТ/verceti.git
git push -u origin main
```

Замініть `ВАШ_АКАУНТ` на свій GitHub username. Не надсилайте нікому пароль або токени.

## 4. Важливо про приватний доступ
- GitHub repository має бути **Private**.
- Публічну реєстрацію в Supabase потрібно вимкнути.
- Додавати тестувальників потрібно лише через запрошення Auth.
- Не вмикайте `NEXT_PUBLIC_DEMO_MODE=true` у production.
- До запуску для реальних користувачів потрібно завершити перевірку RLS, staff-повноважень, запрошень, журналу дій і захисту персональних даних.

## 5. Підключення Supabase (наступний етап)
1. Створіть проєкт: https://supabase.com/
2. У Authentication вимкніть відкриту реєстрацію (Allow new users to sign up).
3. У Project Settings → API скопіюйте Project URL і anon/public key.
4. Додайте їх у `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ваш-проєкт.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ваш-public-anon-key
NEXT_PUBLIC_DEMO_MODE=false
```

5. У SQL Editor виконайте `supabase/schema.sql`.
6. Запросіть першого користувача через Supabase Dashboard → Authentication → Users → Invite user.

**Не використовуйте service_role key у браузері та не додавайте його до `NEXT_PUBLIC_` змінних.**

## 6. Що ще НЕ працює
Поки що не реалізовані: реальні повідомлення чату, аудіо/відео WebRTC, стріми, синхронне відтворення музики, завантаження файлів, живий облік онлайну, система запрошень усередині сайту, повні staff-повноваження та реальні статистичні підрахунки. Сторінки цих розділів — структурні макети для узгодження дизайну.

## Порядок подальшої роботи
1. Перевірити головну сторінку та навігацію.
2. Під'єднати Supabase Auth та приватні запрошення.
3. Реалізувати профілі й права ролей.
4. Анкети та журнал перевірок.
5. Чат, голос, трансляції та інші модулі.
6. Фінальний аудит безпеки перед відкриттям тестувальникам.
