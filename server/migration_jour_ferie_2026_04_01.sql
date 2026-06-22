-- Jours fériés France (calendrier légal) : 2026 → 2030
-- + « 1er avril » le 1er avril chaque année (accord / usage entreprise ; une seule ligne par date).
-- À exécuter sur une base existante : ON CONFLICT (date) met à jour le libellé.
--
-- Référence dates mobiles : lundi de Pâques, ascension, lundi de Pentecôte (calendrier grégorien, métropole).
-- Non inclus : Vendredi saint (Alsace-Moselle seulement).

INSERT INTO jour_ferie (date, nom) VALUES
-- ========== 2026 ==========
('2026-01-01', 'Jour de l''An'),
('2026-04-01', '1er avril'),
('2026-04-06', 'Lundi de Pâques'),
('2026-05-01', 'Fête du Travail'),
('2026-05-08', 'Victoire 1945'),
('2026-05-14', 'Ascension'),
('2026-05-25', 'Lundi de Pentecôte'),
('2026-07-14', 'Fête Nationale'),
('2026-08-15', 'Assomption'),
('2026-11-01', 'Toussaint'),
('2026-11-11', 'Armistice'),
('2026-12-25', 'Noël'),

-- ========== 2027 ==========
('2027-01-01', 'Jour de l''An'),
('2027-04-01', '1er avril'),
('2027-03-29', 'Lundi de Pâques'),
('2027-05-01', 'Fête du Travail'),
('2027-05-06', 'Ascension'),
('2027-05-08', 'Victoire 1945'),
('2027-05-17', 'Lundi de Pentecôte'),
('2027-07-14', 'Fête Nationale'),
('2027-08-15', 'Assomption'),
('2027-11-01', 'Toussaint'),
('2027-11-11', 'Armistice'),
('2027-12-25', 'Noël'),

-- ========== 2028 ==========
('2028-01-01', 'Jour de l''An'),
('2028-04-01', '1er avril'),
('2028-04-17', 'Lundi de Pâques'),
('2028-05-01', 'Fête du Travail'),
('2028-05-08', 'Victoire 1945'),
('2028-05-25', 'Ascension'),
('2028-06-05', 'Lundi de Pentecôte'),
('2028-07-14', 'Fête Nationale'),
('2028-08-15', 'Assomption'),
('2028-11-01', 'Toussaint'),
('2028-11-11', 'Armistice'),
('2028-12-25', 'Noël'),

-- ========== 2029 ==========
('2029-01-01', 'Jour de l''An'),
('2029-04-01', '1er avril'),
('2029-04-02', 'Lundi de Pâques'),
('2029-05-01', 'Fête du Travail'),
('2029-05-08', 'Victoire 1945'),
('2029-05-10', 'Ascension'),
('2029-05-21', 'Lundi de Pentecôte'),
('2029-07-14', 'Fête Nationale'),
('2029-08-15', 'Assomption'),
('2029-11-01', 'Toussaint'),
('2029-11-11', 'Armistice'),
('2029-12-25', 'Noël'),

-- ========== 2030 ==========
('2030-01-01', 'Jour de l''An'),
('2030-04-01', '1er avril'),
('2030-04-22', 'Lundi de Pâques'),
('2030-05-01', 'Fête du Travail'),
('2030-05-08', 'Victoire 1945'),
('2030-05-30', 'Ascension'),
('2030-06-10', 'Lundi de Pentecôte'),
('2030-07-14', 'Fête Nationale'),
('2030-08-15', 'Assomption'),
('2030-11-01', 'Toussaint'),
('2030-11-11', 'Armistice'),
('2030-12-25', 'Noël')

ON CONFLICT (date) DO UPDATE SET nom = EXCLUDED.nom;
