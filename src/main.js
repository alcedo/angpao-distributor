import { Buffer } from "buffer/";

if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}

import("./app.js").then(({ initApp }) => {
  initApp();
});
