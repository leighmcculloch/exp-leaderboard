import { serveDir } from "@std/http/file-server";

const attestationCache = {};

Deno.serve(
  { port: 8080 },
  async (req) => {
    const { pathname, searchParams } = new URL(req.url);

    if (pathname === "/attestation") {
      const repo = searchParams.get("repo");
      const hash = searchParams.get("hash");
      console.log(`Attestation: repo: ${repo} hash: ${hash}`);
      const attestationUrl = `https://api.github.com/repos/${repo}/attestations/sha256:${hash}`;
      console.log(`Attestation: url: ${attestationUrl}`);
      const cached = attestationCache[attestationUrl];
      if (cached) {
        return new Response(cached.data, { status: cached.status, headers: cached.headers });
      }
      const resp = await fetch(attestationUrl);
      const data = await resp.text();
      attestationCache[attestationUrl] = { data, status: resp.status, headers: resp.headers };
      return new Response(data, { status: resp.status, headers: resp.headers });
    }

    return serveDir(req, { fsRoot: "./static", urlRoot: "" });
  }
);
