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
