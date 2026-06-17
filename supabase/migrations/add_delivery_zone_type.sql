-- Add zone_type to delivery_zones
-- 'province'  = existing per-district Sri Lanka zones (default)
-- 'flat_rate' = single flat fee for all of Sri Lanka
-- 'worldwide' = international / worldwide delivery zones

alter table delivery_zones
  add column if not exists zone_type text not null default 'province'
    check (zone_type in ('province', 'flat_rate', 'worldwide'));
