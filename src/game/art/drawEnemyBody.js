import { drawDitchWitch } from '@/game/art/ditchWitchSpriteAnimation';
import drawConeEnemy from '@/game/art/drawConeEnemy';
import drawCrosstalk from '@/game/art/crosstalkSpriteAnimation';
import { drawJitterSprite } from '@/game/art/jitterSpriteAnimation';
import { drawPuddingSprite } from '@/game/art/puddingSpriteAnimation';
import { drawTechEnemy } from '@/game/art/techSpriteAnimation';
import { drawBendSprite } from '@/game/art/bendSpriteAnimation';
import { drawLagSprite } from '@/game/art/enemySpriteAnimation';
import { drawSquirrelSprite } from '@/game/art/squirrelSpriteAnimation';
import { guardedEnemyDraw, drawEnemyFallback, reportEnemyVisual } from '@/game/art/enemyDrawGuard';
import { PETE } from '@/game/data/bosses';

export default function drawEnemyBody(ctx, e) {
  const result = guardedEnemyDraw(ctx, c => {
    if (e.sq?.art) drawSquirrelSprite(c, e.sq.art, e.sq, e.x, e.y);
    else if (e.art) {
      if (e.ditch) drawDitchWitch(c, e.art, e.ditch, e.x, e.y, e.ditch.phase === 'chase');
      else if (e.caster) drawConeEnemy(c, e.art, e.caster, e.x, e.y);
      else if (e.critter) drawCrosstalk(c, e.art, e.critter, e.x, e.y);
      else if (e.jit) drawJitterSprite(c, e.art, e.jit, e.x, e.y, e.jit.phase === 'chase');
      else if (e.kind === 'packet') drawPuddingSprite(c, e.art, e.anim, e.x, e.y);
      else if (['dirty', 'pete', 'peteMini'].includes(e.kind)) drawTechEnemy(c, e.art, e.anim, e.x, e.y, e.kind === 'peteMini' ? PETE.miniScale : 1);
      else if (e.mac) drawBendSprite(c, e.art, e.anim, e.x, e.y);
      else drawLagSprite(c, e.art, e.anim, e.x, e.y);
    }
  });
  if (!result.drawn) {
    reportEnemyVisual(e.kind, result.failure);
    drawEnemyFallback(ctx, e);
  }
  return { id: e.netId ?? e.poolIndex, kind: e.kind, fallback: !result.drawn, failure: result.failure };
}