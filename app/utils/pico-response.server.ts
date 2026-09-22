// Every response here is read by an embedded HTTP client on real hardware (Pico, PicoFerm), not a
// browser — it needs one complete body with an explicit Content-Length, never a streamed/chunked one.
// @react-router/serve bundles Express's compression() middleware ahead of every route, which switches
// a response into chunked mode while it decides whether to compress it — unless Content-Length is
// already set, in which case compression() treats the response as already-final and passes it through
// untouched. Setting it here makes these tiny wire-protocol replies go out exactly as built, matching
// how the real PicoBrew cloud (and the reference chiefwigms/picobrew_pico server) responds.
export function picoResponse(body: string, init?: ResponseInit): Response {
  return new Response(body, {
    ...init,
    headers: {
      'Content-Type': 'text/plain',
      'Content-Length': String(Buffer.byteLength(body, 'utf8')),
      ...init?.headers,
    },
  });
}
