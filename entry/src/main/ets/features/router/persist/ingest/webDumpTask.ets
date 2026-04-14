//src/main/ets/features/router/persist/ingest/webDumpTask.ets
import type { ApiDump } from "../../../../infra/web/types";
import { ParseResult, parseDump, DUMP_PIPELINES, registerPipeline } from "../../../parsers/pipeline";

// Named imports force the ArkTS TaskPool bundler to include these modules.
// Side-effect-only imports ("import './x'") can be stripped by the bundler
// even though they trigger registerPipeline() calls at module level.
// By importing the exported pipeline objects directly, the bundler must
// include the module AND run its top-level registerPipeline() call.
import { portPipeline } from "../../../parsers/pipelines/port";
import { expeditionPipeline } from "../../../parsers/pipelines/expedition";
import { battlePipeline } from "../../../parsers/pipelines/battle";
import { start2Pipeline } from "../../../parsers/pipelines/start2";
import { questPipeline } from "../../../parsers/pipelines/quest";

// Safety net: if for some reason the module-level registerPipeline() calls
// in each pipeline file didn't run (e.g., due to bundler tree-shaking),
// register them explicitly here. Dedup prevents double registration.
const _all = [portPipeline, expeditionPipeline, battlePipeline, start2Pipeline, questPipeline];
for (const p of _all) {
  if (!DUMP_PIPELINES.some(x => x.name === p.name)) {
    registerPipeline(p);
  }
}

@Concurrent
export function parseDumpInWorker(
  url: string,
  requestBody: string,
  responseText: string
): ParseResult {
  const dump: ApiDump = { url, type:'API_DUMP',requestBody, responseText };
  return parseDump(dump);
}
