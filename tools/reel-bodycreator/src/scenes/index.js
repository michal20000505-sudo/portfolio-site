import { loadAssets } from '../common.js';
import s0 from './s0_hook.js';
import s1 from './s1_site.js';
import s2 from './s2_form.js';
import s3 from './s3_end.js';

export const SCENES = [s0, s1, s2, s3];

export async function loadScenes() {
  await loadAssets();
  for (const s of SCENES) await s.load();
}
