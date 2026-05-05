-- =============================================================
-- GameNight — Migration 004: Game Seed Data
-- Run after 003_functions.sql
-- Steam cover images use the stable Akamai CDN format:
--   https://cdn.akamai.steamstatic.com/steam/apps/{appid}/header.jpg
-- Non-Steam games use official CDN / press kit URLs.
-- =============================================================

INSERT INTO public.games
  (title, genres, min_players, max_players, avg_playtime_minutes, cover_url, steam_app_id, is_free)
VALUES

-- ============================================================
-- FPS / TACTICAL SHOOTERS
-- ============================================================
(
  'Counter-Strike 2',
  ARRAY['FPS', 'Tactical', 'Competitive'],
  2, 10, 40,
  'https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg',
  730, true
),
(
  'Valorant',
  ARRAY['FPS', 'Tactical', 'Hero Shooter'],
  2, 10, 35,
  'https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/blt3f072336e3f3ade4/63096d7be4a8c30e088e7720/Valorant_2022_E5A2_PlayVALORANT_ContentStackThumbnail_1200x625_MB01.jpg',
  NULL, true
),
(
  'Rainbow Six Siege',
  ARRAY['FPS', 'Tactical', 'Competitive'],
  2, 10, 25,
  'https://cdn.akamai.steamstatic.com/steam/apps/359550/header.jpg',
  359550, false
),
(
  'Team Fortress 2',
  ARRAY['FPS', 'Class-based', 'Competitive'],
  2, 32, 30,
  'https://cdn.akamai.steamstatic.com/steam/apps/440/header.jpg',
  440, true
),
(
  'Overwatch 2',
  ARRAY['FPS', 'Hero Shooter', 'Competitive'],
  2, 10, 18,
  'https://blz-contentstack-images.akamaized.net/v3/assets/blt9c12f249ac15c7ec/bltbcf2689c29fa39eb/63702d7dc1e8ef1577dd9a71/ow2-header-share-image.jpg',
  NULL, true
),
(
  'Halo Infinite',
  ARRAY['FPS', 'Sci-Fi', 'Competitive'],
  2, 24, 25,
  'https://cdn.akamai.steamstatic.com/steam/apps/1240440/header.jpg',
  1240440, true
),
(
  'Hunt: Showdown 1896',
  ARRAY['FPS', 'Horror', 'Battle Royale'],
  1, 3, 25,
  'https://cdn.akamai.steamstatic.com/steam/apps/594650/header.jpg',
  594650, false
),
(
  'Left 4 Dead 2',
  ARRAY['FPS', 'Co-op', 'Horror'],
  2, 4, 60,
  'https://cdn.akamai.steamstatic.com/steam/apps/550/header.jpg',
  550, false
),
(
  'Deep Rock Galactic',
  ARRAY['FPS', 'Co-op', 'Sci-Fi'],
  1, 4, 40,
  'https://cdn.akamai.steamstatic.com/steam/apps/548430/header.jpg',
  548430, false
),
(
  'Ready or Not',
  ARRAY['FPS', 'Tactical', 'Co-op'],
  1, 8, 45,
  'https://cdn.akamai.steamstatic.com/steam/apps/1144200/header.jpg',
  1144200, false
),
(
  'Helldivers 2',
  ARRAY['FPS', 'Co-op', 'Sci-Fi'],
  1, 4, 40,
  'https://cdn.akamai.steamstatic.com/steam/apps/553850/header.jpg',
  553850, false
),

-- ============================================================
-- BATTLE ROYALE
-- ============================================================
(
  'Apex Legends',
  ARRAY['Battle Royale', 'FPS', 'Hero Shooter'],
  1, 3, 25,
  'https://cdn.akamai.steamstatic.com/steam/apps/1172470/header.jpg',
  1172470, true
),
(
  'Fortnite',
  ARRAY['Battle Royale', 'Survival', 'Sandbox'],
  1, 4, 25,
  'https://cdn2.unrealengine.com/fortnite-chapter5season1-keyart-1920x1080-1920x1080-ed4e8abe44df.jpg',
  NULL, true
),
(
  'Fall Guys',
  ARRAY['Battle Royale', 'Party', 'Platformer'],
  4, 60, 35,
  'https://cdn.akamai.steamstatic.com/steam/apps/1097150/header.jpg',
  1097150, true
),

-- ============================================================
-- MOBA
-- ============================================================
(
  'Dota 2',
  ARRAY['MOBA', 'Strategy', 'Competitive'],
  5, 10, 45,
  'https://cdn.akamai.steamstatic.com/steam/apps/570/header.jpg',
  570, true
),
(
  'League of Legends',
  ARRAY['MOBA', 'Strategy', 'Competitive'],
  5, 10, 35,
  'https://cdn.prod.website-files.com/63d8afd87faa1e4a07dc9a29/63d8afd87faa1e4a07dc9a60_lol-header.jpg',
  NULL, true
),
(
  'Paladins',
  ARRAY['Hero Shooter', 'FPS', 'Strategy'],
  2, 10, 20,
  'https://cdn.akamai.steamstatic.com/steam/apps/444090/header.jpg',
  444090, true
),

-- ============================================================
-- SURVIVAL / OPEN WORLD / SANDBOX
-- ============================================================
(
  'Minecraft',
  ARRAY['Sandbox', 'Survival', 'Creative'],
  2, 8, 120,
  'https://www.minecraft.net/content/dam/games/minecraft/key-art/MC_Anniversary_Arts_Wallpaper_Community_1920x1080.jpg',
  NULL, false
),
(
  'Rust',
  ARRAY['Survival', 'Open World', 'Crafting'],
  2, 500, 120,
  'https://cdn.akamai.steamstatic.com/steam/apps/252490/header.jpg',
  252490, false
),
(
  'ARK: Survival Evolved',
  ARRAY['Survival', 'Open World', 'Crafting'],
  1, 70, 180,
  'https://cdn.akamai.steamstatic.com/steam/apps/346110/header.jpg',
  346110, false
),
(
  'Don''t Starve Together',
  ARRAY['Survival', 'Co-op', 'Roguelite'],
  2, 6, 75,
  'https://cdn.akamai.steamstatic.com/steam/apps/322330/header.jpg',
  322330, false
),
(
  'Terraria',
  ARRAY['Sandbox', 'Survival', 'Adventure'],
  1, 8, 120,
  'https://cdn.akamai.steamstatic.com/steam/apps/105600/header.jpg',
  105600, false
),
(
  'Sea of Thieves',
  ARRAY['Adventure', 'Open World', 'Co-op'],
  1, 4, 90,
  'https://cdn.akamai.steamstatic.com/steam/apps/1172620/header.jpg',
  1172620, false
),
(
  'GTA V Online',
  ARRAY['Open World', 'Action', 'Sandbox'],
  2, 30, 90,
  'https://cdn.akamai.steamstatic.com/steam/apps/271590/header.jpg',
  271590, false
),
(
  'Stardew Valley',
  ARRAY['Farming', 'RPG', 'Co-op'],
  1, 4, 90,
  'https://cdn.akamai.steamstatic.com/steam/apps/413150/header.jpg',
  413150, false
),
(
  'Lethal Company',
  ARRAY['Horror', 'Co-op', 'Survival'],
  1, 4, 40,
  'https://cdn.akamai.steamstatic.com/steam/apps/1966720/header.jpg',
  1966720, false
),

-- ============================================================
-- ACTION RPG / PVE
-- ============================================================
(
  'Destiny 2',
  ARRAY['FPS', 'RPG', 'MMO'],
  1, 6, 45,
  'https://cdn.akamai.steamstatic.com/steam/apps/1085660/header.jpg',
  1085660, true
),
(
  'Monster Hunter: World',
  ARRAY['Action RPG', 'Co-op', 'Hunting'],
  1, 4, 60,
  'https://cdn.akamai.steamstatic.com/steam/apps/582010/header.jpg',
  582010, false
),
(
  'Elden Ring',
  ARRAY['Action RPG', 'Souls-like', 'Co-op'],
  1, 4, 90,
  'https://cdn.akamai.steamstatic.com/steam/apps/1245620/header.jpg',
  1245620, false
),
(
  'Dark Souls III',
  ARRAY['Action RPG', 'Souls-like', 'Co-op'],
  1, 6, 75,
  'https://cdn.akamai.steamstatic.com/steam/apps/374320/header.jpg',
  374320, false
),
(
  'Baldur''s Gate 3',
  ARRAY['RPG', 'Turn-based', 'Co-op'],
  1, 4, 180,
  'https://cdn.akamai.steamstatic.com/steam/apps/1086940/header.jpg',
  1086940, false
),
(
  'Diablo IV',
  ARRAY['ARPG', 'Hack and Slash', 'Co-op'],
  1, 4, 60,
  'https://bnetcmsus-a.akamaihd.net/cms/blog_thumbnail/9t/9TYXE5F9NJ611686068380067.jpg',
  NULL, false
),
(
  'Path of Exile',
  ARRAY['ARPG', 'Hack and Slash', 'Roguelite'],
  1, 6, 90,
  'https://cdn.akamai.steamstatic.com/steam/apps/238960/header.jpg',
  238960, true
),
(
  'Warframe',
  ARRAY['Action RPG', 'Sci-Fi', 'Co-op'],
  1, 4, 45,
  'https://cdn.akamai.steamstatic.com/steam/apps/230410/header.jpg',
  230410, true
),
(
  'Borderlands 3',
  ARRAY['FPS', 'Action RPG', 'Co-op'],
  1, 4, 60,
  'https://cdn.akamai.steamstatic.com/steam/apps/397540/header.jpg',
  397540, false
),

-- ============================================================
-- HORROR / ASYMMETRIC
-- ============================================================
(
  'Dead by Daylight',
  ARRAY['Horror', 'Asymmetric', 'Survival'],
  2, 5, 20,
  'https://cdn.akamai.steamstatic.com/steam/apps/381210/header.jpg',
  381210, false
),
(
  'Phasmophobia',
  ARRAY['Horror', 'Co-op', 'Investigation'],
  1, 4, 40,
  'https://cdn.akamai.steamstatic.com/steam/apps/739630/header.jpg',
  739630, false
),

-- ============================================================
-- CO-OP / PARTY / PUZZLE
-- ============================================================
(
  'Among Us',
  ARRAY['Social Deduction', 'Party', 'Strategy'],
  4, 15, 20,
  'https://cdn.akamai.steamstatic.com/steam/apps/945360/header.jpg',
  945360, false
),
(
  'It Takes Two',
  ARRAY['Co-op', 'Platformer', 'Adventure'],
  2, 2, 75,
  'https://cdn.akamai.steamstatic.com/steam/apps/1426210/header.jpg',
  1426210, false
),
(
  'Portal 2',
  ARRAY['Puzzle', 'Co-op', 'Sci-Fi'],
  2, 2, 60,
  'https://cdn.akamai.steamstatic.com/steam/apps/620/header.jpg',
  620, false
),
(
  'Pummel Party',
  ARRAY['Party', 'Mini-games', 'Board Game'],
  2, 8, 60,
  'https://cdn.akamai.steamstatic.com/steam/apps/880940/header.jpg',
  880940, false
),

-- ============================================================
-- SPORTS / RACING
-- ============================================================
(
  'Rocket League',
  ARRAY['Sports', 'Racing', 'Competitive'],
  1, 8, 10,
  'https://cdn.akamai.steamstatic.com/steam/apps/252950/header.jpg',
  252950, true
);
