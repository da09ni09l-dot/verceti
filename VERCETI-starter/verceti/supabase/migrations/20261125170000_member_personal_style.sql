alter table public.profiles
  add column if not exists nickname_color text not null default '#ff4fd8',
  add column if not exists nickname_font text not null default 'manrope',
  add column if not exists message_color text not null default '#f7f3ff',
  add column if not exists message_font text not null default 'manrope';

alter table public.profiles
  add constraint profiles_nickname_color_check
    check (nickname_color in ('#ff4fd8', '#8b7bff', '#35e6d0', '#b8f34a', '#ffc857', '#ff766e', '#62c8ff', '#e9d5ff')),
  add constraint profiles_nickname_font_check
    check (nickname_font in ('manrope', 'orbitron', 'rajdhani', 'nunito', 'georgia', 'mono')),
  add constraint profiles_message_color_check
    check (message_color in ('#f7f3ff', '#ff9bd5', '#8bdcff', '#8df0c5', '#c5a5ff', '#ffc39b', '#ffe38a')),
  add constraint profiles_message_font_check
    check (message_font in ('manrope', 'orbitron', 'rajdhani', 'nunito', 'georgia', 'mono'));
