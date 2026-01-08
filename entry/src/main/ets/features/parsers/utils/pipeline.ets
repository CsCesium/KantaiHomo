import { ApiDump } from "../../../infra/web/types"
import { PersistEventLite } from "../../router/persist/type"

export interface DumpPipeline {
  name: string
  match: (url: string) => boolean
  parse: (dump: ApiDump) => PersistEventLite[]
}


