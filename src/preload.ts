import dotenv from "dotenv";
import { Request, Response, Headers } from "node-fetch";
import fetch from "node-fetch";

dotenv.config();

// NOTE: 为了兼容 nexe 环境
if (!globalThis.fetch) {
  globalThis.fetch = fetch as any;
  globalThis.Request = Request as any;
  globalThis.Response = Response as any;
  globalThis.Headers = Headers as any;
}
