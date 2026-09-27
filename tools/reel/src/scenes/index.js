import { loadAssets, loadMobile } from '../common.js';
import s0 from './s0_hook.js';
import s1 from './s1_web.js';
import s2 from './s2_brand.js';
import s3 from './s3_3d.js';
import s4 from './s4_game.js';
import s5 from './s5_systems.js';
import s6 from './s6_clients.js';
import s7 from './s7_outro.js';

export const SCENES = [s0, s1, s2, s3, s4, s5, s6, s7];

export async function loadScenes() {
  await loadAssets([
    'web_sscar', 'web_bodycreator', 'web_handybruk', 'web_rmax', 'web_autofutura', 'web_fault_08', 'web_sentracker_trc01', 'web_steam1',
    'poster_foodpoint', 'poster_gromart', 'poster_dunajewska', 'poster_digicamo',
    'card_pirog', 'card_sudbal', 'card_kowalik', 'card_bucz', 'card_render2',
    'game_logo', 'game_boss2', 'game_hivefleetwave', 'game_irontidewave', 'game_the_hunter',
    'sys_rezerwacje', 'sys_kalendarz',
  ]);
  await loadMobile(['sscar', 'bodycreator', 'handybruk', 'rmax']);
  for (const s of SCENES) await s.load();
}
