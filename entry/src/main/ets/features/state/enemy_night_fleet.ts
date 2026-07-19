export interface EnemyNightFleetShipStatus {
  hpAfter: number;
  hpMax: number;
  isTaiha: boolean;
  isChuuha: boolean;
}

/**
 * 敌联合舰队的夜战接敌判定：护卫舰队状态分低于 3 时转而攻击主力。
 * 健在/小破=1，中破=0.7，大破/击沉=0；护卫旗舰 HP>0 另加 1。
 */
export function predictEnemyNightFleet(
  enemyEscort: EnemyNightFleetShipStatus[] | undefined,
): 'main' | 'escort' | undefined {
  if (!enemyEscort || enemyEscort.length === 0) return undefined;

  let score = 0;
  for (let i = 0; i < enemyEscort.length; i++) {
    const ship = enemyEscort[i];
    if (ship.hpMax <= 0) continue;
    if (ship.hpAfter > 0) {
      if (ship.isChuuha) score += 0.7;
      else if (!ship.isTaiha) score += 1;
      if (i === 0) score += 1;
    }
  }
  return score < 3 ? 'main' : 'escort';
}
