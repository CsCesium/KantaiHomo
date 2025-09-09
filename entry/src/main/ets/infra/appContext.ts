import common from '@ohos.app.ability.common';

export type AbilityContext = common.Context;

let ctx: AbilityContext | null = null;

export function setAppContext(c: AbilityContext): void {
  if (!c) throw new Error('[appContext] setAppContext: invalid context');
  ctx = c;
}

export function getAppContext(): AbilityContext {
  if (!ctx) throw new Error('[appContext] getAppContext: context not set yet');
  return ctx;
}