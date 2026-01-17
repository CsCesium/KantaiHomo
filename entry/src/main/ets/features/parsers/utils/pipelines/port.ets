import { ApiDump } from "../../../../infra/web/types";
import { PersistEvent } from "../../../router/persist/type";
import { DumpPipeline } from "../pipeline";

export const portPipeline: DumpPipeline = {
  match(url:string){
    return /\/kcsapi\/api_port\/port\b/.test(url);
  },

  parse(dump:ApiDump):PersistEvent[]{

  }
}