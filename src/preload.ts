import dotenv from "dotenv";
import { Request, Response, Headers } from "node-fetch";
import fetch from "node-fetch";
import { AbortController, AbortSignal } from "node-abort-controller";

dotenv.config();

// NOTE: 为了兼容 nexe 环境
if (!globalThis.fetch) {
  globalThis.fetch = fetch as any;
  globalThis.Request = Request as any;
  globalThis.Response = Response as any;
  globalThis.Headers = Headers as any;
}
// NOTE: nexe 最高只有 node14 ...
if (!globalThis.AbortController) {
  globalThis.AbortController = AbortController as any;
  globalThis.AbortSignal = AbortSignal as any;
}
