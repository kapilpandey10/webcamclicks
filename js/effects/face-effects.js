/* WebcamClicks — face-detection effects index.
   All individual face effects are modularized in ./face/<name>.js. */

import { sunglassesEffect } from './face/sunglasses.js';
import { crownEffect } from './face/crown.js';
import { dogearsEffect } from './face/dogears.js';
import { mustacheEffect } from './face/mustache.js';
import { partyhatEffect } from './face/partyhat.js';
import { bigeyesEffect } from './face/bigeyes.js';
import { faceblurEffect } from './face/faceblur.js';
import { facepixelEffect } from './face/facepixel.js';
import { facemeshEffect } from './face/facemesh.js';
import { emotionEffect } from './face/emotion.js';
import { agegenderEffect } from './face/agegender.js';
import { firebreathEffect } from './face/firebreath.js';
import { confettiEffect } from './face/confetti.js';
import { catearsEffect } from './face/catears.js';
import { angelEffect } from './face/angel.js';
import { cyborgVisorEffect } from './face/cyborg_visor.js';
import { demonHornsEffect } from './face/demon_horns.js';
import { butterflyCrownEffect } from './face/butterfly_crown.js';
import { cyberSamuraiEffect } from './face/cyber_samurai.js';
import { steampunkAviatorEffect } from './face/steampunk_aviator.js';
import { astralMandalaEffect } from './face/astral_mandala.js';
import { ironHudEffect } from './face/iron_hud.js';
import { elvenTiaraEffect } from './face/elven_tiara.js';
import { CROWN_CFG } from './face/crown.js';

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

/** Register all face effects into an EffectManager instance. */
export function registerFaceEffects(manager) {
  manager.registerAll(defsFace);
}
