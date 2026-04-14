import { portPipeline } from './port';
import { expeditionPipeline } from './expedition';
import { battlePipeline } from './battle';
import { start2Pipeline } from './start2';
import { questPipeline } from './quest';
import { DUMP_PIPELINES, registerPipeline, DumpPipeline } from '../pipeline';

export * from './port';
export * from './expedition';
export * from './battle';
export * from './start2';
export * from './quest';

/** 所有 pipeline，按需维护。新增 pipeline 时在此数组添加即可。 */
const ALL_PIPELINES: DumpPipeline[] = [
  portPipeline,
  expeditionPipeline,
  battlePipeline,
  start2Pipeline,
  questPipeline,
];

/**
 * 在 TaskPool worker 中显式注册所有 pipeline。
 *
 * 背景：ArkTS TaskPool bundler 可能剪裁模块顶层的副作用导入，
 * 导致各 pipeline 文件里的 registerPipeline() 顶层调用不执行，
 * DUMP_PIPELINES 始终为空。在 @Concurrent 函数体内调用此函数
 * 可保证注册逻辑一定运行。
 *
 * 已注册时（DUMP_PIPELINES.length > 0）立即返回，worker 复用时无额外开销。
 */
export function initWorkerPipelines(): void {
  if (DUMP_PIPELINES.length > 0) return;
  for (const p of ALL_PIPELINES) {
    registerPipeline(p);
  }
}
