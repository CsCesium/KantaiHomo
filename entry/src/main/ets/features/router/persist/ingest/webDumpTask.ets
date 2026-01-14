//src/main/ets/features/router/persist/ingest/webDumpTask.ets
import { parseDumpToPersist } from "../../../parsers/utils/pipeline";
import { PersistEvent } from "../type";

@Concurrent
export function parseDumpInWorker(
  url: string,
  requestBody: string,
  responseText: string
): PersistEvent[] {
  return parseDumpToPersist({ url: url, requestBody: requestBody, responseText: responseText })
}