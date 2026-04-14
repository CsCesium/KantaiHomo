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

@Concurrent
export function parseDumpInWorker(
  url: string,
  requestBody: string,
  responseText: string
): ParseResult {
  // Register pipelines on first call in this worker context.
  // Module-level side effects may be stripped by the ArkTS TaskPool bundler,
  // so we guarantee registration here — inside the function body that
  // is always executed. The check avoids duplicate registration when
  // the worker thread is reused across multiple tasks.
  if (DUMP_PIPELINES.length === 0) {
    registerPipeline(portPipeline);
    registerPipeline(expeditionPipeline);
    registerPipeline(battlePipeline);
    registerPipeline(start2Pipeline);
    registerPipeline(questPipeline);
  }

  const dump: ApiDump = { url, type:'API_DUMP', requestBody, responseText };
  return parseDump(dump);
}
