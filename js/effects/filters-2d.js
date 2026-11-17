/* WebcamClicks — Canvas 2D effect library index.
   All individual filter effects are modularized in ./filters/<name>.js. */

export * from './filters/filter-helpers.js';

import { trendingEffects } from './filters/trending.js';
import { lookEffects } from './filters/looks.js';
import { cyberpunkHudEffect } from './filters/cyberpunk_hud.js';
import { glitchDimensionEffect } from './filters/glitch_dimension.js';
import { thunderGodEffect } from './filters/thunder_god.js';
import { hologramTransmissionEffect } from './filters/hologram_transmission.js';
import { vortexBlackholeEffect } from './filters/vortex_blackhole.js';
import { retroCamcorderEffect } from './filters/retro_camcorder.js';
import { synthwaveOutrunEffect } from './filters/synthwave_outrun.js';
import { filmNoir1940Effect } from './filters/film_noir_1940.js';
import { animeImpactEffect } from './filters/anime_impact.js';
import { vintageshootEffect } from './filters/vintageshoot.js';
import { portraitbokehEffect } from './filters/portraitbokeh.js';
import { normalEffect } from './filters/normal.js';
import { dreamtrailsEffect } from './filters/dreamtrails.js';
import { popartEffect } from './filters/popart.js';
import { comicEffect } from './filters/comic.js';
import { sketchEffect } from './filters/sketch.js';
import { watercolorEffect } from './filters/watercolor.js';
import { neonEffect } from './filters/neon.js';
import { asciiEffect } from './filters/ascii.js';
import { fisheyeEffect } from './filters/fisheye.js';
import { thermalEffect } from './filters/thermal.js';
import { nightvisionEffect } from './filters/nightvision.js';
import { anamorphicEffect } from './filters/anamorphic.js';
import { vhsEffect } from './filters/vhs.js';
import { kaleidoscopeEffect } from './filters/kaleidoscope.js';
import { mirrorLeftEffect } from './filters/mirrorLeft.js';
import { quadcamEffect } from './filters/quadcam.js';
import { bulgeEffect } from './filters/bulge.js';
import { pinchEffect } from './filters/pinch.js';
import { tunnelEffect } from './filters/tunnel.js';
import { twistEffect } from './filters/twist.js';

export {
  cyberpunkHudEffect,
  glitchDimensionEffect,
  thunderGodEffect,
  hologramTransmissionEffect,
  vortexBlackholeEffect,
  retroCamcorderEffect,
  synthwaveOutrunEffect,
  filmNoir1940Effect,
  animeImpactEffect,
  vintageshootEffect,
  portraitbokehEffect,
  normalEffect,
  dreamtrailsEffect,
  popartEffect,
  comicEffect,
  sketchEffect,
  watercolorEffect,
  neonEffect,
  asciiEffect,
  fisheyeEffect,
  thermalEffect,
  nightvisionEffect,
  anamorphicEffect,
  vhsEffect,
  kaleidoscopeEffect,
  mirrorLeftEffect,
  quadcamEffect,
  bulgeEffect,
  pinchEffect,
  tunnelEffect,
  twistEffect
};

export const defs2d = [
  normalEffect,
  ...trendingEffects,
  ...lookEffects,
  cyberpunkHudEffect,
  glitchDimensionEffect,
  thunderGodEffect,
  hologramTransmissionEffect,
  vortexBlackholeEffect,
  retroCamcorderEffect,
  synthwaveOutrunEffect,
  filmNoir1940Effect,
  animeImpactEffect,
  vintageshootEffect,
  portraitbokehEffect,
  dreamtrailsEffect,
  popartEffect,
  comicEffect,
  sketchEffect,
  watercolorEffect,
  neonEffect,
  asciiEffect,
  fisheyeEffect,
  thermalEffect,
  nightvisionEffect,
  anamorphicEffect,
  vhsEffect,
  kaleidoscopeEffect,
  mirrorLeftEffect,
  quadcamEffect,
  bulgeEffect,
  pinchEffect,
  tunnelEffect,
  twistEffect
];

/** Register all Canvas 2D effects into an EffectManager instance. */
export function register2DFilters(manager) {
  manager.registerAll(defs2d);
}
