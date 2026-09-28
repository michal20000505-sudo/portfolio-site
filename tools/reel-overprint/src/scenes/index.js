// kolejność = kolejność rysowania; world na końcu (czyta S.shake ustawione przez sceny z grą)
import open from './open.js';
import weapons from './weapons.js';
import inks from './inks.js';
import bosses from './bosses.js';
import upgrades from './upgrades.js';
import ranking from './ranking.js';
import site from './site.js';
import outro from './outro.js';
import world from './world.js';
export const SCENES = [open, weapons, inks, bosses, upgrades, ranking, site, outro, world].map(s => ({ ...s }));
