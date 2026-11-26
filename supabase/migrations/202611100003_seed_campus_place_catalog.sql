-- Add Phase 1 expansion places to the searchable campus directory.
-- The source inventory has no confirmed map coordinates for these entries,
-- so they remain explicitly unverified and are not placed as map pins.

insert into public.campus_locations
  (id,name,category,description,latitude,longitude,local_x,local_z,position_status,evidence)
values
  ('saat','SAAT Building','academic','Expansion POI from the v0.2 inventory. Exact building and position need confirmation.',null,null,null,null,'unverified','[{"source":"FUTO Life Map Data Roads Draft v0.2 phase_1_poi_inventory.csv","evidence_status":"unverified"}]'::jsonb),
  ('seset-area','SESET area','academic','Expansion POI from the v0.2 inventory. Exact building and position need confirmation.',null,null,null,null,'unverified','[{"source":"FUTO Life Map Data Roads Draft v0.2 phase_1_poi_inventory.csv","evidence_status":"unverified"}]'::jsonb),
  ('sobs-area','SOBS area','academic','Expansion POI from the v0.2 inventory. Exact building and position need confirmation.',null,null,null,null,'unverified','[{"source":"FUTO Life Map Data Roads Draft v0.2 phase_1_poi_inventory.csv","evidence_status":"unverified"}]'::jsonb),
  ('soht-area','SOHT area','academic','Expansion POI from the v0.2 inventory. Exact building and position need confirmation.',null,null,null,null,'unverified','[{"source":"FUTO Life Map Data Roads Draft v0.2 phase_1_poi_inventory.csv","evidence_status":"unverified"}]'::jsonb),
  ('sops-area','SOPS area','academic','Expansion POI from the v0.2 inventory. Exact building and position need confirmation.',null,null,null,null,'unverified','[{"source":"FUTO Life Map Data Roads Draft v0.2 phase_1_poi_inventory.csv","evidence_status":"unverified"}]'::jsonb),
  ('slit-maritime-area','SLIT / Maritime Building area','academic','Expansion POI from the v0.2 inventory. Confirm the current name, building and position.',null,null,null,null,'unverified','[{"source":"FUTO Life Map Data Roads Draft v0.2 phase_1_poi_inventory.csv","evidence_status":"unverified"}]'::jsonb),
  ('tetfund-hostels','TETFund Hostels','accommodation','Expansion POI from the v0.2 inventory. Current status and position need confirmation.',null,null,null,null,'unverified','[{"source":"FUTO Life Map Data Roads Draft v0.2 phase_1_poi_inventory.csv","evidence_status":"unverified"}]'::jsonb),
  ('ndic-hostel','NDIC Hostel','accommodation','Expansion POI from the v0.2 inventory. Current status and position need confirmation.',null,null,null,null,'unverified','[{"source":"FUTO Life Map Data Roads Draft v0.2 phase_1_poi_inventory.csv","evidence_status":"unverified"}]'::jsonb),
  ('old-seet-roundabout','Old SEET Roundabout / nearby junction','navigation','Keep separate from Football Roundabout until it is confirmed whether these are distinct places.',null,null,null,null,'unverified','[{"source":"FUTO Life Map Data Roads Draft v0.2 phase_1_poi_inventory.csv","evidence_status":"verify_first"}]'::jsonb),
  ('bukka-9','Bukka 9, Umuchima','off-campus','Off-campus future extension; not placed inside the campus boundary.',null,null,null,null,'unverified','[{"source":"FUTO Life Map Data Roads Draft v0.2 phase_1_poi_inventory.csv","evidence_status":"unverified","scope":"off-campus"}]'::jsonb),
  ('sekani-mall','Sekani Mall, Eziobodo','off-campus','Off-campus future extension; not placed inside the campus boundary.',null,null,null,null,'unverified','[{"source":"FUTO Life Map Data Roads Draft v0.2 phase_1_poi_inventory.csv","evidence_status":"unverified","scope":"off-campus"}]'::jsonb)
on conflict (id) do nothing;
