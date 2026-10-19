/* WebcamClicks — Face effects index */

import { sunglassesEffect } from './sunglasses.js';
import { crownEffect } from './crown.js';
import { dogearsEffect } from './dogears.js';
import { mustacheEffect } from './mustache.js';
import { partyhatEffect } from './partyhat.js';
import { bigeyesEffect } from './bigeyes.js';
import { faceblurEffect } from './faceblur.js';
import { facepixelEffect } from './facepixel.js';
import { facemeshEffect } from './facemesh.js';
import { emotionEffect } from './emotion.js';
import { agegenderEffect } from './agegender.js';
import { firebreathEffect } from './firebreath.js';
import { confettiEffect } from './confetti.js';
import { catearsEffect } from './catears.js';
import { angelEffect } from './angel.js';
import { cyborgVisorEffect } from './cyborg_visor.js';
import { demonHornsEffect } from './demon_horns.js';
import { butterflyCrownEffect } from './butterfly_crown.js';
import { cyberSamuraiEffect } from './cyber_samurai.js';
import { steampunkAviatorEffect } from './steampunk_aviator.js';
import { astralMandalaEffect } from './astral_mandala.js';
import { ironHudEffect } from './iron_hud.js';
import { elvenTiaraEffect } from './elven_tiara.js';
import { CROWN_CFG } from './crown.js';

export { CROWN_CFG };
export {
  sunglassesEffect,
  crownEffect,
  dogearsEffect,
  mustacheEffect,
  partyhatEffect,
  bigeyesEffect,
  faceblurEffect,
  facepixelEffect,
  facemeshEffect,
  emotionEffect,
  agegenderEffect,
  firebreathEffect,
  confettiEffect,
  catearsEffect,
  angelEffect,
  cyborgVisorEffect,
  demonHornsEffect,
  butterflyCrownEffect,
  cyberSamuraiEffect,
  steampunkAviatorEffect,
  astralMandalaEffect,
  ironHudEffect,
  elvenTiaraEffect
};

export const defsFace = [
  sunglassesEffect,
  crownEffect,
  dogearsEffect,
  mustacheEffect,
  partyhatEffect,
  bigeyesEffect,
  faceblurEffect,
  facepixelEffect,
  facemeshEffect,
  emotionEffect,
  agegenderEffect,
  firebreathEffect,
  confettiEffect,
  catearsEffect,
  angelEffect,
  cyborgVisorEffect,
  demonHornsEffect,
  butterflyCrownEffect,
  cyberSamuraiEffect,
  steampunkAviatorEffect,
  astralMandalaEffect,
  ironHudEffect,
  elvenTiaraEffect
];

export function registerFaceEffects(manager) {
  manager.registerAll(defsFace);
}

export default defsFace;
