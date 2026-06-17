import { loadConfig } from "./config.ts";
import { closeDb, initDb } from "./db.ts";
import { handlePostSubmit } from "./routes/submit.ts";
import { handleGetSubmission } from "./routes/view.ts";

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
const config = loadConfig();
initDb(config.dataDir);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Attach CORS headers to a response based on config.allowedOrigins. */
function withCors(response: Response): Response {
  if (config.allowedOrigins.length > 0) {
    response.headers.set(
      "Access-Control-Allow-Origin",
      config.allowedOrigins[0],
    );
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Origin",
    );
  }
  return response;
}

/** Log method, path, status, and duration for a request. */
function logRequest(
  method: string,
  path: string,
  status: number,
  duration: number,
): void {
  console.log(`${method} ${path} ${status} ${duration}ms`);
}

/** Parse a submission token from `/submission/:token`. Returns null if no match. */
function parseSubmissionPath(pathname: string): string | null {
  const match = pathname.match(/^\/submission\/([^/]+)$/);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const server = Deno.serve({ port: config.port }, async (req: Request) => {
  const start = Date.now();
  const { method, url } = req;
  const pathname = new URL(url).pathname;

  let res: Response;

  // Handle preflight CORS
  if (method === "OPTIONS") {
    res = new Response(null, { status: 204 });
  } else if (method === "POST" && pathname === "/submit") {
    res = await handlePostSubmit(req, config);
  } else if (method === "GET" && pathname === "/health") {
    res = Response.json({ ok: true });
  } else if (method === "GET" && pathname === "/example") {
    const htmlPath = config.templatesDir + "/example.html";
    try {
      const html = await Deno.readTextFile(htmlPath);
      res = new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch {
      res = new Response("Example template not found", { status: 500 });
    }
  } else if (method === "GET") {
    const token = parseSubmissionPath(pathname);
    if (token) {
      res = handleGetSubmission(token);
    } else {
      res = new Response("Not Found", { status: 404 });
    }
  } else {
    res = new Response("Not Found", { status: 404 });
  }

  // Apply CORS headers to every response
  res = withCors(res);

  // Log
  logRequest(method, pathname, res.status, Date.now() - start);

  return res;
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
Deno.addSignalListener("SIGINT", () => {
  server.shutdown();
  closeDb();
  Deno.exit();
});

Deno.addSignalListener("SIGTERM", () => {
  server.shutdown();
  closeDb();
  Deno.exit();
});

console.log(`form-sink listening on port ${config.port}`);
