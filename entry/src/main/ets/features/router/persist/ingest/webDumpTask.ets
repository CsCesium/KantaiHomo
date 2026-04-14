//src/main/ets/features/router/persist/ingest/webDumpTask.ets
import type { ApiDump } from "../../../../infra/web/types";
import { ParseResult, parseDump } from "../../../parsers/pipeline";
import { initWorkerPipelines } from "../../../parsers/pipelines";

@Concurrent
export function parseDumpInWorker(
  url: string,
  requestBody: string,
  responseText: string
): ParseResult {
  initWorkerPipelines();
  const dump: ApiDump = { url, type: 'API_DUMP', requestBody, responseText };
  return parseDump(dump);
}
