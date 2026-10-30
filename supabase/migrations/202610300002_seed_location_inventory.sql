insert into public.campus_locations (id,name,category,description,latitude,longitude,local_x,local_z,position_status,evidence)
values
('main-gate','FUTO Main Gate','entrance','Spawn location per project owner; no coordinates or photos obtained yet.',null,null,0,0,'provisional','{"verification":"unverified (position); appearance guided by one photograph","references":[{"type":"photograph","provided_by":"project owner","view":"front elevation from the approach road","photographer_watermark_visible":true,"licence":"unknown, so no pixels from it are used as textures"}]}'::jsonb),
('football-roundabout','Football Roundabout','navigation','Exact location must be confirmed.',null,null,null,null,'unverified','{"verification":"unverified","references":[]}'::jsonb),
('senate-building','Senate Building','landmark',null,null,null,-62,-300,'provisional','{"verification":"unverified (position, dimensions); appearance guided by one photograph","references":[{"type":"photograph","provided_by":"project owner","view":"front elevation across a roundabout","licence":"unknown, so no pixels used as textures"}]}'::jsonb),
('main-library','Main Library','landmark','Public sources mention Library Phases II & IV and the E-library as blocks; layout unverified.',null,null,null,null,'unverified','{"verification":"unverified","references":[]}'::jsonb),
('e-library','E-Library','landmark',null,null,null,null,null,'unverified','{"verification":"unverified","references":[]}'::jsonb),
('old-seet-head','Old SEET Head','landmark',null,null,null,null,null,'unverified','{"verification":"unverified","references":[]}'::jsonb),
('futo-ict','FUTO ICT Building','landmark','Keep separate from Old ICT.',null,null,null,null,'unverified','{"verification":"unverified","references":[]}'::jsonb),
('old-ict','Old ICT Building','landmark',null,null,null,null,null,'unverified','{"verification":"unverified","references":[]}'::jsonb),
('hall-of-mercy','Hall of Mercy','lecture',null,null,null,null,null,'unverified','{"verification":"unverified","references":[]}'::jsonb),
('hall-of-excellence','Hall of Excellence','lecture',null,null,null,null,null,'unverified','{"verification":"unverified","references":[]}'::jsonb),
('lt-500','500-Capacity Lecture Theatre','lecture',null,null,null,null,null,'unverified','{"verification":"unverified","references":[]}'::jsonb),
('seet','SEET Complex','academic',null,null,null,null,null,'unverified','{"verification":"unverified","references":[]}'::jsonb),
('sosc','SOSC Building','academic',null,null,null,null,null,'unverified','{"verification":"unverified","references":[]}'::jsonb),
('smat','SMAT Complex','academic',null,null,null,null,null,'unverified','{"verification":"unverified","references":[]}'::jsonb),
('soes-soet','SOES/SOET area','academic','Verify current naming.',null,null,null,null,'unverified','{"verification":"unverified","references":[]}'::jsonb),
('sict','SICT/Computer Science area','academic',null,null,null,null,null,'unverified','{"verification":"unverified","references":[]}'::jsonb),
('gst','Directorate of General Studies/GST Building','academic',null,null,null,null,null,'unverified','{"verification":"unverified","references":[]}'::jsonb),
('bukataria','Bukataria','student-life',null,null,null,null,null,'unverified','{"verification":"unverified","references":[]}'::jsonb),
('sunic-eatery','Sunic Eatery','student-life',null,null,null,null,null,'unverified','{"verification":"unverified","references":[]}'::jsonb),
('futo-cafe','FUTO Cafe','student-life',null,null,null,null,null,'unverified','{"verification":"unverified","references":[]}'::jsonb),
('futo-market','FUTO Market','student-life',null,null,null,null,null,'unverified','{"verification":"unverified","references":[]}'::jsonb),
('hostel-zones','Major hostel zones','student-life','Zones to be identified individually.',null,null,null,null,'unverified','{"verification":"unverified","references":[]}'::jsonb)
on conflict (id) do nothing;

