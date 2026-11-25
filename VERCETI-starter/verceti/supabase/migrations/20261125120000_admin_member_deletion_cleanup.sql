-- Allow the service-role admin cleanup to detach member references.
GRANT SELECT, UPDATE ON TABLE
  public.rewards_prizes,
  public.news,
  public.community_rules,
  public.rules_history
TO service_role;

-- Keep the historical reward-spin record while anonymizing its former owner.
ALTER TABLE public.rewards_spins
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.rewards_spins
  DROP CONSTRAINT IF EXISTS rewards_spins_user_id_fkey;

ALTER TABLE public.rewards_spins
  ADD CONSTRAINT rewards_spins_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;
