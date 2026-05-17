-- Import popular Romanian fishing lakes from curated CSV.

alter table if exists public.lakes
  add column if not exists source_url text,
  add column if not exists verification_status text,
  add column if not exists notes text;

with new_lakes (
  name,
  county,
  distance_km,
  lat,
  lon,
  lake_type,
  description,
  website_url,
  facebook_url,
  phone,
  rules,
  price,
  source_url,
  verification_status,
  notes
) as (
  values
  ('Balta Lilieci', 'Ilfov', null, 44.555054, 26.382189, 'commercial', 'Balta de pescuit aproape de Bucuresti, zona Lilieci/Sindrilita.', null, null, '0762615334', 'Maxim 4 lansete sau o undita; fara plantat conform sursei.', '50 RON/12h zi/noapte; 100 RON/24h (sursa veche)', 'https://www.pescuitinfo.ro/balta-lilieci', 'gps_contact_found_public_source', 'GPS+telefon din PescuitInfo; pret vechi, de verificat'),
  ('Balta Petrachioaia', 'Ilfov', null, 44.58049, 26.307283, 'commercial', 'Balta de pescuit in zona Petrachioaia.', null, null, '076800237', 'Maxim 1 undita sau 4 lansete; retinere max 5 kg conform sursei.', '70 RON/12h (sursa veche)', 'https://www.pescuitinfo.ro/balta-petrachioaia', 'gps_contact_found_public_source', 'GPS+telefon din PescuitInfo; pret vechi, de verificat'),
  ('Balta Movilita', 'Ialomita', null, 44.629635, 26.458498, 'commercial', 'Complex cu mai multe balti amenajate, zona Movilita.', null, null, '0766699141', 'Maxim 5 scule; plantatul permis; somnul nu se retine conform sursei.', '40 RON/12h + 40 RON plantat (sursa veche)', 'https://www.pescuitinfo.ro/balta-movilita', 'gps_contact_found_public_source', 'GPS+telefon din PescuitInfo; pret vechi, de verificat'),
  ('Balta Belciugatele', 'Calarasi', null, 44.477379, 26.44874, 'commercial', 'Balta de pescuit in zona Belciugatele.', null, null, '0756067921', 'Maxim 5 lansete si 2 undite; retinere 4-5 kg in functie de balta conform sursei.', '50-60 RON/12h (sursa veche)', 'https://www.pescuitinfo.ro/balta-belciugatele', 'gps_contact_found_public_source', 'GPS+telefon din PescuitInfo; pret vechi, de verificat'),
  ('Balta Fundulea 1', 'Calarasi', null, 44.490898, 26.434401, 'commercial', 'Balta de pescuit sportiv din zona Fundulea.', null, null, '0728 451 034', 'Regulamentul sezonier trebuie verificat telefonic.', '60 RON/12h; 100 RON/24h (sursa veche)', 'https://www.pescuitinfo.ro/balta-fundulea-1', 'gps_contact_found_public_source', 'GPS+telefon din PescuitInfo; pret vechi, de verificat'),
  ('Balta Matara 2', 'Calarasi', null, 44.545341, 26.469584, 'commercial', 'Balta de pescuit in zona Mariuta/Fundulea.', null, null, '0720 302 54', 'Limita 5 kg; fara plantat conform sursei.', '50 RON/12h (sursa veche)', 'https://www.pescuitinfo.ro/balta-matara-2', 'gps_contact_found_public_source', 'GPS+telefon din PescuitInfo; pret vechi, de verificat'),
  ('Balta Lehliu Sat 2', 'Calarasi', null, 44.463619, 26.814667, 'commercial', 'Balta de pescuit in zona Lehliu Sat.', null, null, '0765231363', 'Regulament de verificat telefonic.', '50 RON/12h (sursa veche)', 'https://www.pescuitinfo.ro/balta-lehliu-sat-2', 'gps_contact_found_public_source', 'GPS+telefon din PescuitInfo; pret vechi, de verificat'),
  ('Lacul Sarulesti Sandulita Raduta', 'Calarasi', null, 44.401024, 26.661057, 'commercial', 'Lac renumit pentru pescuit la crap si concursuri, zona Sarulesti/Raduta.', null, null, '0767 807 714', 'Regulament specific lacului; verifica actualitatea cu administratorul.', '300 EUR/saptamana (sursa veche)', 'https://www.pescuitinfo.ro/lacul-sarulesti-sandulita-raduta', 'gps_contact_found_public_source', 'GPS+telefon din PescuitInfo; pret vechi, de verificat'),
  ('Balta Putineiu La Conac', 'Giurgiu', null, 43.915752, 25.732838, 'commercial', 'Balta de pescuit La Conac, zona Putineiu.', null, null, '0744 538 211', 'Regulament de verificat telefonic.', null, 'https://www.pescuitinfo.ro/balta-putineiu-la-conac', 'gps_contact_found_public_source', 'GPS+telefon din PescuitInfo'),
  ('Balta Vlasin', 'Giurgiu', null, 44.140636, 25.930338, 'commercial', 'Balta de pescuit si recreere in zona Vlasin.', null, null, '0722221080, 0765441036', 'Regulament de verificat telefonic.', null, 'https://www.pescuitinfo.ro/balta-vlasin', 'gps_contact_found_public_source', 'GPS+telefon din PescuitInfo'),
  ('Balta Romanesti', 'Dambovita', null, 44.563843, 25.615698, 'commercial', 'Balta de pescuit in zona Romanesti.', null, null, '0722927995, 0763910450', 'Regulament de verificat telefonic.', null, 'https://www.pescuitinfo.ro/balta-romanesti', 'gps_contact_found_public_source', 'GPS+telefon din PescuitInfo'),
  ('Laguna Verde Balotesti-Fieni', 'Ilfov', null, 44.624706, 26.128391, 'commercial', 'Complex de pescuit si agrement langa Bucuresti, zona Balotesti-Fieni.', null, null, '0733079091, 0722204758', 'Maxim 6 lansete; retinere max 6 kg; plantat cu navomodele conform sursei.', null, 'https://www.pescuitinfo.ro/balta-balotesti-fieni-laguna-verde', 'gps_contact_found_public_source', 'GPS+telefon/email din PescuitInfo; verifica site oficial actual'),
  ('Iazul Vlasia', 'Ilfov', null, 44.646862, 26.077608, 'commercial', 'Iaz de pescuit in zona Vlasia/Snagov.', null, null, '0726744989', 'Regulament de verificat telefonic.', null, 'https://www.pescuitinfo.ro/balta-iazul-vlasia', 'gps_contact_found_public_source', 'GPS+telefon din PescuitInfo'),
  ('Balta Cernica', 'Ilfov', null, 44.4189, 26.27, 'commercial', 'Balta/lac de pescuit in zona Cernica.', null, null, '0726 243 452', 'Regulament de verificat telefonic.', null, 'https://www.pescuitinfo.ro/balta-cernica', 'gps_contact_found_public_source', 'GPS+telefon din PescuitInfo'),
  ('Balta Caldarusani', 'Ilfov', null, 44.671375, 26.266275, 'commercial', 'Balta de pescuit din zona Caldarusani/Moara Vlasiei.', null, null, '0767842754', 'Maxim 4 lansete; nu se retine stiuca/salau; interzis pescuitul la bomba conform sursei.', '60 RON/12h (sursa veche)', 'https://www.pescuitinfo.ro/balta-caldarusani', 'gps_contact_found_public_source', 'GPS+telefon din PescuitInfo; pret vechi, de verificat'),
  ('Balta Boteni 2', 'Ilfov', null, 44.56717543991782, 26.45370023185822, 'commercial', 'Balta privata de pescuit, cunoscuta si ca Balta Plina/Boteni 2.', 'https://baltaplina.ro', 'https://www.facebook.com/baltaboteni', '0784 174 174', 'Regulament de verificat pe site/pagina inainte de partida.', null, 'https://www.pescaramator.ro/balta-boteni-2/', 'gps_contact_found_public_source', 'Coordonate introduse manual anterior; telefon/site din PescarAmator'),
  ('Balta Nitchidorf', 'Timis', null, 45.584183, 21.52861, 'commercial', 'Balta de pescuit in zona Nitchidorf, Timis.', null, null, '0769 632 664', 'Regulament de verificat telefonic.', null, 'https://www.pescuitinfo.ro/balta-nitchidorf', 'gps_contact_found_public_source', 'GPS+telefon din PescuitInfo'),
  ('Balta Verde Pecica', 'Arad', null, 46.207367, 21.156246, 'commercial', 'Balta Verde din zona Pecica/Sederhat, Arad.', 'http://www.balta-verde.ro', null, '0740 152 425', 'Regulament de verificat pe site/telefonic.', null, 'https://www.pescuitinfo.ro/balta-verde', 'gps_contact_found_public_source', 'GPS+telefon+website din PescuitInfo'),
  ('Doripesco Vadu Rosu Balta 4', 'Brasov', null, 45.873592, 25.55514, 'commercial', 'Balta 4 Doripesco, Vadu Rosu, Brasov.', 'https://doripesco.ro', null, '0268 481 581, 0268 481 682, 0726 709 793', 'Regulament Doripesco / balta 4; verifica actualizarea sezoniera.', null, 'https://www.pescuitinfo.ro/doripesco-vadu-rosu-balta-4', 'gps_contact_found_public_source', 'GPS+telefon din PescuitInfo; website oficial adaugat'),
  ('Balta Stigma Fishing', 'Brasov', null, 45.799309, 24.671078, 'commercial', 'Balta Stigma Fishing, zona Ucea.', null, null, '0758114755', 'Regulament de verificat telefonic.', '100 RON/12h; C&R 40-50 RON (sursa veche)', 'https://www.pescuitinfo.ro/balta-stigma-fishing', 'gps_contact_found_public_source', 'GPS+telefon din PescuitInfo; pret vechi, de verificat'),
  ('Lac Sfantul Florian', 'Cluj', null, 46.850681, 24.094521, 'commercial', 'Lac de pescuit in zona Cluj.', null, null, '0749792749', 'Regulament de verificat telefonic.', '30 RON/zi/noapte (sursa veche)', 'https://www.pescuitinfo.ro/lac-sfantul-florian', 'gps_contact_found_public_source', 'GPS+telefon din PescuitInfo; pret vechi, de verificat'),
  ('Balta Dintre Sate', 'Prahova', null, 44.813404, 26.491165, 'commercial', 'Balta de pescuit din zona Ploiesti.', 'http://www.pescuit-la-balta.ro', null, '0762 831 583', 'Regulament de verificat pe site/telefonic.', null, 'https://www.pescuitinfo.ro/balta-dintre-sate', 'gps_contact_found_public_source', 'GPS+telefon+web din PescuitInfo'),
  ('Balta Ciocarlia 4', 'Ialomita', null, 44.720589, 26.645975, 'commercial', 'Balta de pescuit in zona Ciocarlia, Ialomita.', null, null, '0741209934', 'Regulament de verificat telefonic.', null, 'https://www.pescuitinfo.ro/balta-ciocarlia-4', 'gps_contact_found_public_source', 'GPS+telefon din PescuitInfo'),
  ('Balta Balauru', 'Timis', null, 45.734238, 21.195246, 'commercial', 'Balta de pescuit in zona Timisoara.', null, null, '0356 945 654', 'Regulament de verificat telefonic.', '10 RON/24h (sursa veche)', 'https://www.pescuitinfo.ro/balta-balauru', 'gps_contact_found_public_source', 'GPS+telefon din PescuitInfo; pret vechi, de verificat')
)
insert into public.lakes (
  name,
  county,
  distance_km,
  lat,
  lon,
  lake_type,
  description,
  website_url,
  facebook_url,
  website,
  facebook,
  phone,
  rules,
  price,
  source_url,
  verification_status,
  notes,
  active
)
select
  v.name,
  v.county,
  v.distance_km::numeric,
  v.lat::double precision,
  v.lon::double precision,
  v.lake_type,
  v.description,
  v.website_url,
  v.facebook_url,
  v.website_url,
  v.facebook_url,
  v.phone,
  v.rules,
  v.price,
  v.source_url,
  v.verification_status,
  v.notes,
  true
from new_lakes v
where not exists (
  select 1
  from public.lakes l
  where lower(l.name) = lower(v.name)
);
