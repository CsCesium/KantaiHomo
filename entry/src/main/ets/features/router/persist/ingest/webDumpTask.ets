//src/main/ets/features/router/persist/ingest/webDumpTask.ets
import { ApiDump } from "../../../../infra/web/types";
import { ParseResult, parseDump } from "../../../parsers/pipeline";

@Concurrent
export function parseDumpInWorker(
  url: string,
  requestBody: string,
  responseText: string
): ParseResult {
  const dump: ApiDump = { url, requestBody, responseText };
  return parseDump(dump);
}