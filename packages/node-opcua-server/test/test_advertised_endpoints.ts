import "should";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { SecurityPolicy } from "node-opcua-secure-channel";
import { OPCUAServer } from "../source";
import { parseOpcTcpUrl } from "../source/server_end_point";
import { createServerCertificateManager } from "./create_server_certificate_manager";

describe("parseOpcTcpUrl", () => {
    it("should parse a standard opc.tcp URL", () => {
        const result = parseOpcTcpUrl("opc.tcp://localhost:48481");
        result.hostname.should.eql("localhost");
        result.port.should.eql(48481);
    });

    it("should parse a URL without explicit port (default to 4840)", () => {
        const result = parseOpcTcpUrl("opc.tcp://myhost");
        result.hostname.should.eql("myhost");
        result.port.should.eql(4840);
    });

    it("should parse a URL with a named host", () => {
        const result = parseOpcTcpUrl("opc.tcp://demo-server-1:26543");
        result.hostname.should.eql("demo-server-1");
        result.port.should.eql(26543);
    });

    it("should handle case-insensitive scheme", () => {
        const result = parseOpcTcpUrl("OPC.TCP://MyServer:4840");
        result.hostname.should.eql("myserver");
        result.port.should.eql(4840);
    });
});

describe("OPCUAServer with advertisedEndpoints", () => {
    it("should advertise endpoints with the specified hostname and port", async () => {
        const serverCertificateManager = await createServerCertificateManager(12061);

        const server = new OPCUAServer({
            port: 12061,
            serverCertificateManager,
            nodeset_filename: [nodesets.standard],
            securityPolicies: [SecurityPolicy.None, SecurityPolicy.Basic256Sha256],
            advertisedEndpoints: ["opc.tcp://localhost:48481"]
        });

        try {
            await server.initialize();

            let matchingAdvertised = 0;
            let matchingListenPort = 0;

            for (const e of server.endpoints) {
                for (const ed of e.endpointDescriptions()) {
                    const url = ed.endpointUrl || "";
                    if (url.includes("localhost") && url.includes("48481")) {
                        matchingAdvertised++;
                    }
                    if (url.includes(":12061")) {
                        matchingListenPort++;
                    }
                }
            }

            matchingAdvertised.should.be.greaterThan(0, "should have endpoints for the advertised URL");
            matchingListenPort.should.be.greaterThan(0, "should still have endpoints on the listen port");
        } finally {
            await server.shutdown();
            server.dispose();
        }
    });

    it("should accept an array of advertisedEndpoints", async () => {
        const serverCertificateManager = await createServerCertificateManager(12062);

        const server = new OPCUAServer({
            port: 12062,
            serverCertificateManager,
            nodeset_filename: [nodesets.standard],
            securityPolicies: [SecurityPolicy.None, SecurityPolicy.Basic256Sha256],
            advertisedEndpoints: ["opc.tcp://localhost:48481", "opc.tcp://public.example.com:4840"]
        });

        try {
            await server.initialize();

            let matchingLocalhost = 0;
            let matchingPublic = 0;

            for (const e of server.endpoints) {
                for (const ed of e.endpointDescriptions()) {
                    const url = ed.endpointUrl || "";
                    if (url.includes("localhost") && url.includes("48481")) {
                        matchingLocalhost++;
                    }
                    if (url.includes("public.example.com") && url.includes("4840")) {
                        matchingPublic++;
                    }
                }
            }

            matchingLocalhost.should.be.greaterThan(0, "should have endpoints for localhost:48481");
            matchingPublic.should.be.greaterThan(0, "should have endpoints for public.example.com:4840");
        } finally {
            await server.shutdown();
            server.dispose();
        }
    });

    it("should skip duplicate hostname+port that matches listen address", async () => {
        const serverCertificateManager = await createServerCertificateManager(12063);

        const server = new OPCUAServer({
            port: 12063,
            hostname: "myhost",
            serverCertificateManager,
            nodeset_filename: [nodesets.standard],
            securityPolicies: [SecurityPolicy.None],
            // This one duplicates the main endpoint (same hostname + same port)
            advertisedEndpoints: ["opc.tcp://myhost:12063"]
        });

        try {
            await server.initialize();

            let matchingMyHost = 0;
            for (const e of server.endpoints) {
                for (const ed of e.endpointDescriptions()) {
                    const url = ed.endpointUrl || "";
                    if (url.includes("myhost")) {
                        matchingMyHost++;
                    }
                }
            }

            matchingMyHost.should.eql(1, "should not duplicate endpoints when advertised URL matches listen address");
        } finally {
            await server.shutdown();
            server.dispose();
        }
    });

    it("should accept a single string for advertisedEndpoints", async () => {
        const serverCertificateManager = await createServerCertificateManager(12064);

        const server = new OPCUAServer({
            port: 12064,
            serverCertificateManager,
            nodeset_filename: [nodesets.standard],
            securityPolicies: [SecurityPolicy.None],
            advertisedEndpoints: "opc.tcp://singlehost:9999"
        });

        try {
            await server.initialize();

            let matchingSingle = 0;
            for (const e of server.endpoints) {
                for (const ed of e.endpointDescriptions()) {
                    const url = ed.endpointUrl || "";
                    if (url.includes("singlehost") && url.includes("9999")) {
                        matchingSingle++;
                    }
                }
            }

            matchingSingle.should.be.greaterThan(0, "should have endpoints for the single advertised URL");
        } finally {
            await server.shutdown();
            server.dispose();
        }
    });

    it("should not break when advertisedEndpoints is omitted", async () => {
        const serverCertificateManager = await createServerCertificateManager(12065);

        const server = new OPCUAServer({
            port: 12065,
            serverCertificateManager,
            nodeset_filename: [nodesets.standard],
            securityPolicies: [SecurityPolicy.None]
        });

        try {
            await server.initialize();

            const endpoints = server.endpoints[0].endpointDescriptions();
            endpoints.length.should.be.greaterThan(0);
        } finally {
            await server.shutdown();
            server.dispose();
        }
    });
});

const port = 12055;

describe("US-AE-03/04: Endpoint resolution with advertisedEndpoints (used by GetEndpoints and CreateSession)", () => {
    // findMatchingEndpoints() is the shared code path used by both:
    //   - _on_GetEndpointsRequest (base_server.ts)
    //   - validate_security_endpoint in CreateSession (opcua_server.ts)

    it("should return only advertised endpoints when filtering by advertised URL", async () => {
        const serverCertificateManager = await createServerCertificateManager(port);

        const server = new OPCUAServer({
            port,
            serverCertificateManager,
            nodeset_filename: [nodesets.standard],
            securityPolicies: [SecurityPolicy.None, SecurityPolicy.Basic256Sha256],
            advertisedEndpoints: ["opc.tcp://dockerhost:48481"]
        });

        try {
            await server.initialize();

            // findMatchingEndpoints(null) should return ALL endpoints (main + advertised)
            const allEndpoints = server.findMatchingEndpoints(null);
            const mainUrls = allEndpoints.filter((e) => e.endpointUrl?.includes(`:${port}`));
            const advertisedUrls = allEndpoints.filter((e) => e.endpointUrl?.includes("dockerhost:48481"));

            mainUrls.length.should.be.greaterThan(0, "should have main endpoints");
            advertisedUrls.length.should.be.greaterThan(0, "should have advertised endpoints");
            allEndpoints.length.should.eql(
                mainUrls.length + advertisedUrls.length,
                "total should equal main + advertised (no extras)"
            );

            // findMatchingEndpoints with advertised URL should return only matching
            const filtered = server.findMatchingEndpoints("opc.tcp://dockerhost:48481");
            filtered.length.should.be.greaterThan(0, "filtered should find advertised endpoints");
            for (const ep of filtered) {
                (ep.endpointUrl || "").should.containEql("dockerhost:48481");
            }

            // findMatchingEndpoints with main URL should return only main
            const filteredMain = server.findMatchingEndpoints(`opc.tcp://RAMSES:${port}`);
            for (const ep of filteredMain) {
                (ep.endpointUrl || "").should.not.containEql("dockerhost");
            }
        } finally {
            await server.shutdown();
            server.dispose();
        }
    });

    it("should return empty when URL matches nothing", async () => {
        const serverCertificateManager = await createServerCertificateManager(port + 1);

        const server = new OPCUAServer({
            port: port + 1,
            serverCertificateManager,
            nodeset_filename: [nodesets.standard],
            securityPolicies: [SecurityPolicy.None],
            advertisedEndpoints: ["opc.tcp://myhost:1234"]
        });

        try {
            await server.initialize();

            // Non-matching URL — findMatchingEndpoints returns empty
            const filtered = server.findMatchingEndpoints("opc.tcp://unknown:9999");
            filtered.length.should.eql(0, "non-matching URL should return empty from findMatchingEndpoints");

            // Note: _on_GetEndpointsRequest falls back to all endpoints when filtered is empty
            // (see base_server.ts: if filtered.length > 0 then use filtered)
        } finally {
            await server.shutdown();
            server.dispose();
        }
    });
});

const sanPort = 12070;

describe("US-AE-06/07: Certificate SAN includes configured hostnames", () => {
    it("should include alternateHostname in the self-signed cert SAN", async () => {
        const { exploreCertificate } = await import("node-opcua-crypto/web");

        const serverCertificateManager = await createServerCertificateManager(sanPort);

        const server = new OPCUAServer({
            port: sanPort,
            serverCertificateManager,
            nodeset_filename: [nodesets.standard],
            securityPolicies: [SecurityPolicy.None],
            alternateHostname: ["alt-host-1", "alt-host-2"]
        });

        // delete existing cert to force regeneration
        if (await import("node:fs").then(fs => fs.existsSync(server.certificateFile))) {
            await import("node:fs").then(fs => fs.unlinkSync(server.certificateFile));
        }

        try {
            await server.initialize();

            const certDer = server.getCertificate();
            const info = exploreCertificate(certDer);
            const sanDns = info.tbsCertificate.extensions?.subjectAltName?.dNSName || [];

            sanDns.should.containEql("alt-host-1");
            sanDns.should.containEql("alt-host-2");
        } finally {
            await server.shutdown();
            server.dispose();
        }
    });

    it("should include advertisedEndpoints hostnames in the self-signed cert SAN", async () => {
        const { exploreCertificate } = await import("node-opcua-crypto/web");

        const serverCertificateManager = await createServerCertificateManager(sanPort + 1);

        const server = new OPCUAServer({
            port: sanPort + 1,
            serverCertificateManager,
            nodeset_filename: [nodesets.standard],
            securityPolicies: [SecurityPolicy.None],
            advertisedEndpoints: ["opc.tcp://dockerhost:48481", "opc.tcp://proxy.example.com:4840"]
        });

        // delete existing cert to force regeneration
        if (await import("node:fs").then(fs => fs.existsSync(server.certificateFile))) {
            await import("node:fs").then(fs => fs.unlinkSync(server.certificateFile));
        }

        try {
            await server.initialize();

            const certDer = server.getCertificate();
            const info = exploreCertificate(certDer);
            const sanDns = info.tbsCertificate.extensions?.subjectAltName?.dNSName || [];

            sanDns.should.containEql("dockerhost");
            sanDns.should.containEql("proxy.example.com");
        } finally {
            await server.shutdown();
            server.dispose();
        }
    });

    it("should produce a sorted and deduplicated dns list", async () => {
        const { exploreCertificate } = await import("node-opcua-crypto/web");

        const serverCertificateManager = await createServerCertificateManager(sanPort + 2);

        const server = new OPCUAServer({
            port: sanPort + 2,
            serverCertificateManager,
            nodeset_filename: [nodesets.standard],
            securityPolicies: [SecurityPolicy.None],
            alternateHostname: ["zzz-host", "aaa-host"],
            advertisedEndpoints: ["opc.tcp://aaa-host:9999"]  // duplicate with alternateHostname
        });

        // delete existing cert to force regeneration
        if (await import("node:fs").then(fs => fs.existsSync(server.certificateFile))) {
            await import("node:fs").then(fs => fs.unlinkSync(server.certificateFile));
        }

        try {
            await server.initialize();

            const certDer = server.getCertificate();
            const info = exploreCertificate(certDer);
            const sanDns = info.tbsCertificate.extensions?.subjectAltName?.dNSName || [];

            // aaa-host should appear only once (deduplication)
            const aaaCount = sanDns.filter((d: string) => d === "aaa-host").length;
            aaaCount.should.eql(1, "aaa-host should be deduplicated");

            // dns list should be sorted
            const sorted = [...sanDns].sort();
            sanDns.should.deepEqual(sorted, "dns entries should be sorted");
        } finally {
            await server.shutdown();
            server.dispose();
        }
    });
});
