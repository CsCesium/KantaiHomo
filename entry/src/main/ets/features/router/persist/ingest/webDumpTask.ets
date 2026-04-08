//src/main/ets/features/router/persist/ingest/webDumpTask.ets
import { ApiDump } from "../../../../infra/web/types";
import { ParseResult, parseDump } from "../../../parsers/pipeline";
import "../../../parsers/pipelines"; // trigger side-effect pipeline registrations in worker

@Concurrent
export function parseDumpInWorker(
  url: string,
  requestBody: string,
  responseText: string
): ParseResult {
  const dump: ApiDump = { url, type:'API_DUMP',requestBody, responseText };
  return parseDump(dump);
}