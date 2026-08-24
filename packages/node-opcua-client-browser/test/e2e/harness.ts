/**
 * E2E harness (scaffold).
 *
 * Builds the test page with esbuild and serves it over a plain HTTP server
 * so a Playwright browser can load it. The harness is intentionally minimal:
 * later PRs will layer on a demo `node-opcua-server` and a TCP↔WebSocket
 * bridge (`start-ws-bridge.ts`) so specs can drive a full OPC UA session
 * through the browser. For now the only thing a spec can assert is that
 * `test/page/main.ts` loaded and reported a `status` back to the page.
 */

import { readFileSync, statSync } from "node:fs";
import { createServer as createHttpServer, type Server as HttpServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface StaticServer {
    url: string;
    port: number;
    close: () => Promise<void>;
}

export interface HarnessContext {
    /** The static-server URL hosting the test page. */
    pageUrl: string;
    /** Static page server. */
    pageServer: StaticServer;
    /** Shut everything down. */
    stopAll: () => Promise<void>;
}

const packageDir = resolve(__dirname, "..", "..");
const pageDistDir = resolve(packageDir, "test", "page", "dist");

const MIME_BY_EXT: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".map": "application/json; charset=utf-8"
};

async function startStaticServer(rootDir: string): Promise<StaticServer> {
    const server: HttpServer = createHttpServer((req, res) => {
        const urlPath = (req.url || "/").split("?", 1)[0];
        const safePath = urlPath === "/" ? "/index.html" : urlPath;
        const filePath = join(rootDir, safePath);
        try {
            if (!statSync(filePath).isFile()) throw new Error("not a file");
            const body = readFileSync(filePath);
            res.setHeader("content-type", MIME_BY_EXT[extname(filePath)] ?? "application/octet-stream");
            res.end(body);
        } catch {
            res.statusCode = 404;
            res.end("not found");
        }
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const addr = server.address();
    if (!addr || typeof addr === "string") {
        throw new Error("static server address unavailable");
    }
    const url = `http://127.0.0.1:${addr.port}`;
    return {
        url,
        port: addr.port,
        close: () => new Promise<void>((r, rej) => server.close((err) => (err ? rej(err) : r())))
    };
}

export async function startHarness(): Promise<HarnessContext> {
    // Dynamic import — `build-test-page.mjs` is plain JS with no type
    // declaration and lives outside the test tsconfig scope.
    const buildModuleUrl = pathToFileURL(resolve(packageDir, "build-test-page.mjs")).href;
    const { buildTestPage } = (await import(buildModuleUrl)) as {
        buildTestPage: (opts?: { logLevel?: string; sourcemap?: boolean }) => Promise<string>;
    };
    await buildTestPage({ logLevel: "warning" });
    const pageServer = await startStaticServer(pageDistDir);

    const stopAll = async () => {
        await pageServer.close();
    };

    return {
        pageUrl: pageServer.url,
        pageServer,
        stopAll
    };
}
