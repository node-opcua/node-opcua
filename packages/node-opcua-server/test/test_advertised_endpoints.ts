import { ipv4ToHex } from "node-opcua-hostname";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { MessageSecurityMode, SecurityPolicy } from "node-opcua-secure-channel";
import { UserTokenType } from "node-opcua-service-endpoints";
import "should";

import { OPCUAServer } from "../source";
import { type AdvertisedEndpointConfig, normalizeAdvertisedEndpoints, parseOpcTcpUrl } from "../source/server_end_point";
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

const ae08Port = 12080;

describe("US-AE-08/09: Certificate SAN mismatch check and regeneration", () => {
    it("checkCertificateSAN should return missing hostnames", async () => {
        const fs = await import("node:fs");

        const serverCertificateManager = await createServerCertificateManager(ae08Port);

        // Step 1: create server WITHOUT alternateHostname to get a cert with only fqdn/hostname
        const server1 = new OPCUAServer({
            port: ae08Port,
            serverCertificateManager,
            nodeset_filename: [nodesets.standard],
            securityPolicies: [SecurityPolicy.None]
        });

        // delete existing cert to force regeneration
        if (fs.existsSync(server1.certificateFile)) {
            fs.unlinkSync(server1.certificateFile);
        }

        try {
            await server1.initialize();
            // cert now exists with only fqdn+hostname in SAN
        } finally {
            await server1.shutdown();
            server1.dispose();
        }

        // Step 2: create a new server WITH alternateHostname using the SAME cert
        const server2 = new OPCUAServer({
            port: ae08Port,
            serverCertificateManager,
            nodeset_filename: [nodesets.standard],
            securityPolicies: [SecurityPolicy.None],
            alternateHostname: ["new-alt-host"]
        });

        try {
            await server2.initialize();

            // checkCertificateSAN should detect "new-alt-host" is missing
            const missing = server2.checkCertificateSAN();
            missing.should.containEql("new-alt-host");
        } finally {
            await server2.shutdown();
            server2.dispose();
        }
    });

    it("regenerateSelfSignedCertificate should create cert with all hostnames", async () => {
        const fs = await import("node:fs");
        const { exploreCertificate } = await import("node-opcua-crypto/web");

        const serverCertificateManager = await createServerCertificateManager(ae08Port + 1);

        // Step 1: create server with only basic cert
        const server = new OPCUAServer({
            port: ae08Port + 1,
            serverCertificateManager,
            nodeset_filename: [nodesets.standard],
            securityPolicies: [SecurityPolicy.None],
            alternateHostname: ["regen-host"]
        });

        // delete existing cert to get a fresh one WITHOUT regen-host
        if (fs.existsSync(server.certificateFile)) {
            fs.unlinkSync(server.certificateFile);
        }

        try {
            await server.initialize();

            // Verify cert initially includes regen-host
            const certBefore = server.getCertificate();
            const infoBefore = exploreCertificate(certBefore);
            const sanBefore = infoBefore.tbsCertificate.extensions?.subjectAltName?.dNSName || [];
            sanBefore.should.containEql("regen-host");

            // Now regenerate
            await server.regenerateSelfSignedCertificate();

            // New cert should also have regen-host
            const certAfter = server.getCertificate();
            const infoAfter = exploreCertificate(certAfter);
            const sanAfter = infoAfter.tbsCertificate.extensions?.subjectAltName?.dNSName || [];
            sanAfter.should.containEql("regen-host");

            // checkCertificateSAN should return empty (all covered)
            const missing = server.checkCertificateSAN();
            missing.should.have.length(0);
        } finally {
            await server.shutdown();
            server.dispose();
        }
    });
});

const ae18Port = 12090;


describe("US-AE-18: IP/hostname segregation in cert SAN", () => {
    it("should put IP from alternateHostname into SAN iPAddress, not dNSName", async () => {
        const fs = await import("node:fs");
        const { exploreCertificate } = await import("node-opcua-crypto/web");

        const serverCertificateManager = await createServerCertificateManager(ae18Port);

        const server = new OPCUAServer({
            port: ae18Port,
            serverCertificateManager,
            nodeset_filename: [nodesets.standard],
            securityPolicies: [SecurityPolicy.None],
            alternateHostname: ["192.168.1.100"]
        });

        if (fs.existsSync(server.certificateFile)) {
            fs.unlinkSync(server.certificateFile);
        }

        try {
            await server.initialize();

            const certDer = server.getCertificate();
            const info = exploreCertificate(certDer);
            const sanDns = info.tbsCertificate.extensions?.subjectAltName?.dNSName || [];
            const sanIps = info.tbsCertificate.extensions?.subjectAltName?.iPAddress || [];

            // IP must be in iPAddress (as hex), NOT in dNSName
            sanIps.should.containEql(ipv4ToHex("192.168.1.100"));
            sanDns.should.not.containEql("192.168.1.100");
        } finally {
            await server.shutdown();
            server.dispose();
        }
    });

    it("should split mixed alternateHostname into dNSName and iPAddress", async () => {
        const fs = await import("node:fs");
        const { exploreCertificate } = await import("node-opcua-crypto/web");

        const serverCertificateManager = await createServerCertificateManager(ae18Port + 1);

        const server = new OPCUAServer({
            port: ae18Port + 1,
            serverCertificateManager,
            nodeset_filename: [nodesets.standard],
            securityPolicies: [SecurityPolicy.None],
            alternateHostname: ["my-docker-host", "10.0.0.1"]
        });

        if (fs.existsSync(server.certificateFile)) {
            fs.unlinkSync(server.certificateFile);
        }

        try {
            await server.initialize();

            const certDer = server.getCertificate();
            const info = exploreCertificate(certDer);
            const sanDns = info.tbsCertificate.extensions?.subjectAltName?.dNSName || [];
            const sanIps = info.tbsCertificate.extensions?.subjectAltName?.iPAddress || [];

            // hostname → dNSName
            sanDns.should.containEql("my-docker-host");
            sanDns.should.not.containEql("10.0.0.1");

            // IP → iPAddress (as hex)
            sanIps.should.containEql(ipv4ToHex("10.0.0.1"));
            sanIps.should.not.containEql("my-docker-host");
        } finally {
            await server.shutdown();
            server.dispose();
        }
    });

    it("should put IP from advertisedEndpoints URL into SAN iPAddress", async () => {
        const fs = await import("node:fs");
        const { exploreCertificate } = await import("node-opcua-crypto/web");

        const serverCertificateManager = await createServerCertificateManager(ae18Port + 2);

        const server = new OPCUAServer({
            port: ae18Port + 2,
            serverCertificateManager,
            nodeset_filename: [nodesets.standard],
            securityPolicies: [SecurityPolicy.None],
            advertisedEndpoints: "opc.tcp://172.17.0.1:4840"
        });

        if (fs.existsSync(server.certificateFile)) {
            fs.unlinkSync(server.certificateFile);
        }

        try {
            await server.initialize();

            const certDer = server.getCertificate();
            const info = exploreCertificate(certDer);
            const sanDns = info.tbsCertificate.extensions?.subjectAltName?.dNSName || [];
            const sanIps = info.tbsCertificate.extensions?.subjectAltName?.iPAddress || [];

            // IP literal from URL → iPAddress (as hex), not dNSName
            sanIps.should.containEql(ipv4ToHex("172.17.0.1"));
            sanDns.should.not.containEql("172.17.0.1");
        } finally {
            await server.shutdown();
            server.dispose();
        }
    });
});

describe("getIpAddresses", () => {
    it("should return at least one non-internal IPv4 address", () => {
        const { getIpAddresses } = require("node-opcua-hostname");
        const ips: string[] = getIpAddresses();
        ips.length.should.be.greaterThan(0);
        for (const ip of ips) {
            // basic IPv4 format check
            ip.should.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
            ip.should.not.equal("127.0.0.1");
        }
    });
});

describe("regenerateSelfSignedCertificate includes IPs", () => {
    it("should include IPs in the regenerated certificate", async () => {
        const fs = await import("node:fs");
        const { exploreCertificate } = await import("node-opcua-crypto/web");
        const { getIpAddresses } = await import("node-opcua-hostname");

        const serverCertificateManager = await createServerCertificateManager(ae18Port + 3);

        const server = new OPCUAServer({
            port: ae18Port + 3,
            serverCertificateManager,
            nodeset_filename: [nodesets.standard],
            securityPolicies: [SecurityPolicy.None],
            alternateHostname: ["10.99.0.1"]
        });

        if (fs.existsSync(server.certificateFile)) {
            fs.unlinkSync(server.certificateFile);
        }

        try {
            await server.initialize();

            // Regenerate
            await server.regenerateSelfSignedCertificate();

            const certDer = server.getCertificate();
            const info = exploreCertificate(certDer);
            const sanIps = info.tbsCertificate.extensions?.subjectAltName?.iPAddress || [];

            // The configured IP must be present
            sanIps.should.containEql(ipv4ToHex("10.99.0.1"));

            // Auto-detected IPs should also be present
            const hostIps = getIpAddresses();
            for (const ip of hostIps) {
                sanIps.should.containEql(ipv4ToHex(ip));
            }
        } finally {
            await server.shutdown();
            server.dispose();
        }
    });
});

const ae10Port = 12100;

describe("US-AE-10: normalizeAdvertisedEndpoints", () => {
    it("should normalize a single string to AdvertisedEndpointConfig[]", () => {
        const result = normalizeAdvertisedEndpoints("opc.tcp://host:4840");
        result.should.deepEqual([{ url: "opc.tcp://host:4840" }]);
    });

    it("should normalize an array of strings", () => {
        const result = normalizeAdvertisedEndpoints([
            "opc.tcp://a:1",
            "opc.tcp://b:2"
        ]);
        result.should.have.length(2);
        result[0].url.should.equal("opc.tcp://a:1");
        result[1].url.should.equal("opc.tcp://b:2");
    });

    it("should pass through config objects unchanged", () => {
        const config: AdvertisedEndpointConfig = {
            url: "opc.tcp://public:4840",
            securityModes: [MessageSecurityMode.SignAndEncrypt],
            allowAnonymous: false
        };
        const result = normalizeAdvertisedEndpoints(config);
        result.should.deepEqual([config]);
    });

    it("should handle mixed arrays", () => {
        const result = normalizeAdvertisedEndpoints([
            "opc.tcp://a:1",
            { url: "opc.tcp://b:2", allowAnonymous: false }
        ]);
        result.should.have.length(2);
        result[0].url.should.equal("opc.tcp://a:1");
        result[1].url.should.equal("opc.tcp://b:2");
        result[1].allowAnonymous!.should.equal(false);
    });

    it("should return empty array for undefined", () => {
        const result = normalizeAdvertisedEndpoints(undefined);
        result.should.have.length(0);
    });
});

describe("US-AE-11: per-URL security overrides", () => {
    it("should restrict advertised URL to SignAndEncrypt only", async () => {
        const serverCertificateManager = await createServerCertificateManager(ae10Port);

        const server = new OPCUAServer({
            port: ae10Port,
            serverCertificateManager,
            nodeset_filename: [nodesets.standard],
            securityModes: [
                MessageSecurityMode.None,
                MessageSecurityMode.Sign,
                MessageSecurityMode.SignAndEncrypt
            ],
            advertisedEndpoints: {
                url: "opc.tcp://restricted-host:4840",
                securityModes: [MessageSecurityMode.SignAndEncrypt]
            }
        });

        try {
            await server.initialize();

            const endpoints = server.endpoints
                .flatMap((ep) => ep.endpointDescriptions());

            // Endpoints for the advertised URL
            const restrictedEps = endpoints.filter(
                (e) => e.endpointUrl!.includes("restricted-host")
            );

            // Should only have SignAndEncrypt mode (plus maybe a
            // restricted None for discovery)
            const securedEps = restrictedEps.filter(
                (e) => e.securityMode !== MessageSecurityMode.None
            );
            for (const ep of securedEps) {
                ep.securityMode.should.equal(
                    MessageSecurityMode.SignAndEncrypt
                );
            }

            // No Sign-only endpoints for the restricted URL
            const signOnly = restrictedEps.filter(
                (e) => e.securityMode === MessageSecurityMode.Sign
            );
            signOnly.should.have.length(0);
        } finally {
            await server.shutdown();
            server.dispose();
        }
    });

    it("should suppress AnonymousIdentityToken when allowAnonymous is false", async () => {
        const serverCertificateManager = await createServerCertificateManager(ae10Port + 1);

        const server = new OPCUAServer({
            port: ae10Port + 1,
            serverCertificateManager,
            nodeset_filename: [nodesets.standard],
            allowAnonymous: true, // main endpoint allows anon
            advertisedEndpoints: {
                url: "opc.tcp://no-anon-host:4840",
                allowAnonymous: false
            }
        });

        try {
            await server.initialize();

            const endpoints = server.endpoints
                .flatMap((ep) => ep.endpointDescriptions());

            const noAnonEps = endpoints.filter(
                (e) => e.endpointUrl!.includes("no-anon-host")
            );
            noAnonEps.length.should.be.greaterThan(0);

            for (const ep of noAnonEps) {
                const tokenTypes = (ep.userIdentityTokens || []).map(
                    (t) => t.tokenType
                );
                tokenTypes.should.not.containEql(UserTokenType.Anonymous);
            }

            // Main endpoint should still allow anonymous
            const mainEps = endpoints.filter(
                (e) => !e.endpointUrl!.includes("no-anon-host")
            );
            const hasAnon = mainEps.some((e) =>
                (e.userIdentityTokens || []).some(
                    (t) => t.tokenType === UserTokenType.Anonymous
                )
            );
            hasAnon.should.equal(true);
        } finally {
            await server.shutdown();
            server.dispose();
        }
    });
});

describe("US-AE-12: string shorthand inherits main settings", () => {
    it("should produce same security modes for string and main endpoint", async () => {
        const serverCertificateManager = await createServerCertificateManager(ae10Port + 2);

        const server = new OPCUAServer({
            port: ae10Port + 2,
            serverCertificateManager,
            nodeset_filename: [nodesets.standard],
            securityModes: [
                MessageSecurityMode.None,
                MessageSecurityMode.SignAndEncrypt
            ],
            advertisedEndpoints: "opc.tcp://inherited-host:4840"
        });

        try {
            await server.initialize();

            const endpoints = server.endpoints
                .flatMap((ep) => ep.endpointDescriptions());

            const mainEps = endpoints.filter(
                (e) => !e.endpointUrl!.includes("inherited-host")
            );
            const inheritedEps = endpoints.filter(
                (e) => e.endpointUrl!.includes("inherited-host")
            );

            // Both should have the same security modes
            const mainModes = [...new Set(
                mainEps.map((e) => e.securityMode)
            )].sort();
            const inheritedModes = [...new Set(
                inheritedEps.map((e) => e.securityMode)
            )].sort();

            inheritedModes.should.deepEqual(mainModes);
        } finally {
            await server.shutdown();
            server.dispose();
        }
    });
});
