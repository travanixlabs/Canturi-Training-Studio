-- Canturi Training Studio — Seed Data
-- Run this AFTER schema.sql in the Supabase SQL editor

-- ─────────────────────────────────────────
-- BOUTIQUES
-- ─────────────────────────────────────────
insert into public.boutiques (id, name, city) values
  ('11111111-0000-0000-0000-000000000001', 'Canturi Sydney', 'Sydney'),
  ('11111111-0000-0000-0000-000000000002', 'Canturi Melbourne', 'Melbourne'),
  ('11111111-0000-0000-0000-000000000003', 'Canturi Brisbane', 'Brisbane');

-- ─────────────────────────────────────────
-- CATEGORIES
-- ─────────────────────────────────────────
insert into public.categories (id, name, icon, colour_hex, sort_order) values
  ('22222222-0000-0000-0000-000000000001', 'Services', '✦', '#8B6355', 1),
  ('22222222-0000-0000-0000-000000000002', 'Product Knowledge', '◈', '#4A6B8A', 2),
  ('22222222-0000-0000-0000-000000000003', 'Boutique', '⌂', '#6B8C6B', 3),
  ('22222222-0000-0000-0000-000000000004', 'Administration', '◎', '#7A7068', 4),
  ('22222222-0000-0000-0000-000000000005', 'Diamonds', '◇', '#7B6B9A', 5),
  ('22222222-0000-0000-0000-000000000006', 'Deliveries', '▽', '#7A7355', 6),
  ('22222222-0000-0000-0000-000000000007', 'Client Experience', '❋', '#9A6B70', 7);

-- ─────────────────────────────────────────
-- MENU ITEMS — Services
-- ─────────────────────────────────────────
insert into public.menu_items (title, description, category_id, tags, time_needed, trainer_type, priority_level, is_recurring) values
  (
    'Ultrasonic Clean',
    'Learn to operate the ultrasonic cleaning machine safely. Understand which pieces can and cannot go in — no pearls, emeralds, treated stones, or glued settings. Demonstrate correct solution levels and cycle times.',
    '22222222-0000-0000-0000-000000000001',
    array['ultrasonic', 'clean', 'cleaning', 'jewellery care', 'services'],
    '20 min',
    'Manager',
    'week_1',
    false
  ),
  (
    'Steam Clean',
    'Operate the steam cleaner for final jewellery finishing. Understand pressure settings, safe distances, and which pieces cannot be steamed. Practice on display pieces before handling client pieces.',
    '22222222-0000-0000-0000-000000000001',
    array['steam', 'clean', 'cleaning', 'finishing', 'services'],
    '15 min',
    'Manager',
    'week_1',
    false
  ),
  (
    'Ring Sizing',
    'Understand Canturi ring sizing process — how to measure client fingers accurately, consult the sizing guide, and communicate sizing lead times. Know which styles can be sized and which cannot.',
    '22222222-0000-0000-0000-000000000001',
    array['ring sizing', 'sizing', 'alterations', 'repairs', 'services'],
    '30 min',
    'Self/Manager',
    'week_2_4',
    false
  ),
  (
    'Engraving Service',
    'Know the engraving options available (script, block, symbols), character limits per piece, and turnaround times. Understand how to take an engraving order accurately and enter it into the system.',
    '22222222-0000-0000-0000-000000000001',
    array['engraving', 'personalisation', 'services'],
    '20 min',
    'Self/Manager',
    'week_2_4',
    false
  ),
  (
    'Repairs & Alterations',
    'Learn the full repairs intake process — condition reporting, photography, completing the repair form, client communication for ETA, and how to handle pieces with sentimental value.',
    '22222222-0000-0000-0000-000000000001',
    array['repairs', 'alterations', 'services', 'JCS'],
    '45 min',
    'Manager',
    'week_2_4',
    false
  );

-- ─────────────────────────────────────────
-- MENU ITEMS — Product Knowledge
-- ─────────────────────────────────────────
insert into public.menu_items (title, description, category_id, tags, time_needed, trainer_type, priority_level, is_recurring) values
  (
    'Canturi Collections Overview',
    'Deep-dive into all current Canturi collections — design philosophy, signature elements, price architecture, and target client profiles. Be able to speak fluently about each collection without referencing notes.',
    '22222222-0000-0000-0000-000000000002',
    array['collections', 'product', 'knowledge', 'ranges'],
    '60 min',
    'Self/Manager',
    'week_1',
    false
  ),
  (
    'Metals & Alloys',
    'Understand 18ct yellow gold, white gold, and rose gold — composition, properties, care requirements, and how to communicate quality to a client. Know how to answer "why does white gold need rhodium plating?"',
    '22222222-0000-0000-0000-000000000002',
    array['metals', 'gold', 'white gold', 'rose gold', 'product knowledge'],
    '30 min',
    'Self',
    'week_1',
    false
  ),
  (
    'Coloured Stones',
    'Introduction to sapphires, rubies, emeralds, and other coloured stones stocked by Canturi. Understand treatment disclosure, origin stories, and how to describe quality to a client in an engaging way.',
    '22222222-0000-0000-0000-000000000002',
    array['coloured stones', 'sapphire', 'ruby', 'emerald', 'gemstones', 'product knowledge'],
    '45 min',
    'Self/Manager',
    'week_2_4',
    false
  ),
  (
    'Packaging & Presentation',
    'Know the full Canturi packaging suite — box sizes, ribbon tying, tissue placement, gift card positioning. Every piece leaves the boutique as a gift. Practice until the presentation is flawless.',
    '22222222-0000-0000-0000-000000000002',
    array['packaging', 'presentation', 'gifting', 'ribbons', 'boxes'],
    '20 min',
    'Manager',
    'week_1',
    false
  );

-- ─────────────────────────────────────────
-- MENU ITEMS — Boutique
-- ─────────────────────────────────────────
insert into public.menu_items (title, description, category_id, tags, time_needed, trainer_type, priority_level, is_recurring) values
  (
    'Opening Procedure',
    'Complete the full boutique opening sequence — safe access, case setup, lighting, display refresh, POS login, and morning team briefing. Be able to open independently within your first two weeks.',
    '22222222-0000-0000-0000-000000000003',
    array['opening', 'boutique', 'procedure', 'safe'],
    '30 min',
    'Manager',
    'week_1',
    false
  ),
  (
    'Closing Procedure',
    'Full closing sequence — client tracking, safe packing, case security, alarm protocol, and end-of-day reporting. This is a high-trust task; accuracy is non-negotiable.',
    '22222222-0000-0000-0000-000000000003',
    array['closing', 'boutique', 'procedure', 'safe', 'alarm'],
    '30 min',
    'Manager',
    'week_1',
    false
  ),
  (
    'Salon Standards',
    'Canturi boutique standards — display spacing, mirror placement, lighting checks, refreshment presentation, and scent. Walk through the boutique with fresh eyes every morning and before any VIP visit.',
    '22222222-0000-0000-0000-000000000003',
    array['salon', 'standards', 'display', 'boutique', 'presentation'],
    '20 min',
    'Self/Manager',
    'week_1',
    true  -- revisit daily; this is a habit, not a one-time tick
  );

-- ─────────────────────────────────────────
-- MENU ITEMS — Administration
-- ─────────────────────────────────────────
insert into public.menu_items (title, description, category_id, tags, time_needed, trainer_type, priority_level, is_recurring) values
  (
    'RECAP System',
    'Learn the RECAP CRM system — creating client profiles, logging interactions, adding purchase history, and running client lookup. Every client interaction should be recorded same day.',
    '22222222-0000-0000-0000-000000000004',
    array['RECAP', 'CRM', 'system', 'administration', 'clients'],
    '60 min',
    'Manager',
    'week_1',
    false
  ),
  (
    'JCS Repairs System',
    'Understand the JCS jewellery repair tracking system — creating repair jobs, adding condition notes, photographing pieces, and tracking status through to completion.',
    '22222222-0000-0000-0000-000000000004',
    array['JCS', 'repairs', 'system', 'administration'],
    '45 min',
    'Manager',
    'week_2_4',
    false
  ),
  (
    'FOC & Complimentary Forms',
    'Know when and how to raise FOC (free of charge) and complimentary service forms — approval levels, documentation required, and how to process in the system without leaving a paper trail gap.',
    '22222222-0000-0000-0000-000000000004',
    array['FOC', 'complimentary', 'forms', 'administration'],
    '30 min',
    'Manager',
    'week_2_4',
    false
  );

-- ─────────────────────────────────────────
-- MENU ITEMS — Diamonds
-- ─────────────────────────────────────────
insert into public.menu_items (title, description, category_id, tags, time_needed, trainer_type, priority_level, is_recurring) values
  (
    'The 4Cs — Cut, Colour, Clarity, Carat',
    'Master the 4Cs framework and be able to explain each C to a client in plain, engaging language. Know how Canturi uses the 4Cs in sourcing decisions and how to guide a client through trade-offs.',
    '22222222-0000-0000-0000-000000000005',
    array['diamonds', '4cs', 'cut', 'colour', 'clarity', 'carat', 'knowledge'],
    '60 min',
    'Self/Manager',
    'week_1',
    false
  ),
  (
    'Diamond Certificates',
    'Understand GIA and other certification bodies. Know how to read a certificate, explain grading reports to clients, and connect the cert to the physical stone in a consultation.',
    '22222222-0000-0000-0000-000000000005',
    array['diamonds', 'certificate', 'GIA', 'grading', 'certification'],
    '45 min',
    'Self/Manager',
    'week_2_4',
    false
  ),
  (
    'Engagement Consultation',
    'Run a complete engagement ring consultation — from opening questions about the partner, through diamond selection, to setting styles and custom options. Practice the flow from start to quote.',
    '22222222-0000-0000-0000-000000000005',
    array['engagement', 'consultation', 'diamonds', 'rings', 'bespoke'],
    '90 min',
    'Manager',
    'advanced',
    false
  );

-- ─────────────────────────────────────────
-- MENU ITEMS — Deliveries
-- ─────────────────────────────────────────
insert into public.menu_items (title, description, category_id, tags, time_needed, trainer_type, priority_level, is_recurring) values
  (
    'Receiving Stock',
    'Full stock receiving process — signing off delivery, checking contents against the packing slip, condition assessment, photography, and entering new stock into the system accurately.',
    '22222222-0000-0000-0000-000000000006',
    array['deliveries', 'stock', 'receiving', 'inventory'],
    '30 min',
    'Manager',
    'week_1',
    false
  ),
  (
    'Inter-Boutique Transfers',
    'Process and documentation for sending stock between Canturi boutiques — packaging standards, carrier booking, tracking, and system updates at both ends.',
    '22222222-0000-0000-0000-000000000006',
    array['transfers', 'inter-boutique', 'stock', 'deliveries'],
    '30 min',
    'Manager',
    'week_2_4',
    false
  );

-- ─────────────────────────────────────────
-- MENU ITEMS — Client Experience
-- ─────────────────────────────────────────
insert into public.menu_items (title, description, category_id, tags, time_needed, trainer_type, priority_level, is_recurring) values
  (
    'The Canturi Welcome',
    'The first 60 seconds of a client''s visit sets the tone. Learn the Canturi welcome — eye contact, greeting, offer of water, and how to read whether a client wants to browse or be guided.',
    '22222222-0000-0000-0000-000000000007',
    array['welcome', 'client experience', 'greeting', 'service'],
    '20 min',
    'Manager',
    'week_1',
    true  -- revisit regularly; this is a standard to maintain
  ),
  (
    'Gifting & Special Occasions',
    'How to handle gift purchases — wrapping, cards, special requests, and how to make the moment feel personal and memorable without the recipient present. Know all gifting options and timelines.',
    '22222222-0000-0000-0000-000000000007',
    array['gifting', 'special occasions', 'packaging', 'client experience'],
    '30 min',
    'Self/Manager',
    'week_1',
    false
  ),
  (
    'After-Sale Care & Client Follow-Up',
    'The sale doesn''t end at the register. Understand the Canturi after-care process — follow-up call timing, care card presentation, and how to nurture a new client into a repeat client.',
    '22222222-0000-0000-0000-000000000007',
    array['after sale', 'follow up', 'client care', 'client experience', 'retention'],
    '30 min',
    'Self/Manager',
    'week_2_4',
    false
  ),
  (
    'Difficult Client Conversations',
    'How to handle complaints, returns, and challenging client situations with grace. Understand escalation paths, what you can resolve independently, and how to protect the client relationship.',
    '22222222-0000-0000-0000-000000000007',
    array['difficult clients', 'complaints', 'returns', 'escalation', 'client experience'],
    '45 min',
    'Manager',
    'advanced',
    false
  );

-- ─────────────────────────────────────────
-- PREREQUISITES
-- Wire up sequencing after all items are inserted
-- ─────────────────────────────────────────

-- Diamond Certificates requires: The 4Cs
update public.menu_items
set prerequisites = array(
  select id from public.menu_items where title = 'The 4Cs — Cut, Colour, Clarity, Carat'
)
where title = 'Diamond Certificates';

-- Engagement Consultation requires: The 4Cs + Diamond Certificates
update public.menu_items
set prerequisites = array(
  select id from public.menu_items
  where title in ('The 4Cs — Cut, Colour, Clarity, Carat', 'Diamond Certificates')
)
where title = 'Engagement Consultation';

-- Repairs & Alterations requires: JCS Repairs System
update public.menu_items
set prerequisites = array(
  select id from public.menu_items where title = 'JCS Repairs System'
)
where title = 'Repairs & Alterations';

-- Closing Procedure requires: Opening Procedure
update public.menu_items
set prerequisites = array(
  select id from public.menu_items where title = 'Opening Procedure'
)
where title = 'Closing Procedure';

-- ─────────────────────────────────────────
-- NOTE: Test users must be created via Supabase Auth
-- (Authentication > Users > Invite user) then their
-- public.users records will auto-populate via the trigger.
-- After creating auth users, run this UPDATE to set roles:
--
-- update public.users set
--   role = 'manager',
--   boutique_id = '11111111-0000-0000-0000-000000000001',
--   avatar_initials = 'SL'
-- where email = 'silvia@canturi.com.au';
--
-- See README.md for full test user setup instructions.
-- ─────────────────────────────────────────
