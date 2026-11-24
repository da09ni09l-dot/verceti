alter table public.workshop_bookings
  drop constraint if exists workshop_bookings_hour_slot_check;

alter table public.workshop_bookings
  add constraint workshop_bookings_half_hour_slot_check
  check (hour_slot >= 0 and hour_slot <= 47);
