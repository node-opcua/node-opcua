import fs from "node:fs";
import path from "node:path";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { StaticCertificateChainProvider } from "node-opcua-common";
import { combine_der, readCertificateChain } from "node-opcua-crypto";
import type { Certificate } from "node-opcua-crypto/web";
import { extractFullyQualifiedDomainName, getFullyQualifiedDomainName } from "node-opcua-hostname";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { invalidPrivateKey, MessageSecurityMode, SecurityPolicy } from "node-opcua-secure-channel";
import { ApplicationDescription, EndpointDescription, UserTokenType } from "node-opcua-service-endpoints";
import should from "should";
import { OPCUABaseServer, OPCUAServerEndPoint } from "..";

const it_with_crypto = it;

const port = 2042;

const certificateChain: Certificate[] = [];

function getOptions() {
    const options = {
        hostname: getFullyQualifiedDomainName(),
        securityPolicies: [SecurityPolicy.Basic256Sha256],
        userTokenTypes: [UserTokenType.UserName]
    };
    return options;
}

describe("OPCUAServerEndpoint#addEndpointDescription", function (this: Mocha.Suite) {
    let server_endpoint: OPCUAServerEndPoint;
    let certificateManager: OPCUACertificateManager;
    before(async () => {
        await extractFullyQualifiedDomainName();
        certificateManager = new OPCUACertificateManager({});
    });
    after(() => {
        certificateManager.dispose();
    });

    beforeEach(() => {
        server_endpoint = new OPCUAServerEndPoint({
            port: port,
            serverInfo: new ApplicationDescription({}),
            certificateChain,
            privateKey: invalidPrivateKey,
            certificateManager
        });
    });

    const _param = {};

    it("should  accept  to add endpoint endMessageSecurityMode.None and SecurityPolicy.None", () => {
        const options = getOptions();
        should(() => {
            server_endpoint.addEndpointDescription(MessageSecurityMode.None, SecurityPolicy.None, options);
        }).not.throwError();
    });

    it("should  accept  to add endpoint endMessageSecurityMode.None and SecurityPolicy.None twice", () => {
        const options = getOptions();
        server_endpoint.addEndpointDescription(MessageSecurityMode.None, SecurityPolicy.None, options);
        should(() => {
            server_endpoint.addEndpointDescription(MessageSecurityMode.None, SecurityPolicy.None, options);
        }).throwError();
    });

    it("should not accept to add endpoint with MessageSecurityMode.None and SecurityPolicy.Basic128", () => {
        const options = getOptions();
        should(() => {
            server_endpoint.addEndpointDescription(MessageSecurityMode.None, SecurityPolicy.Basic128, options);
        }).throwError();
    });
    it("should not accept  to add endpoint  MessageSecurityMode.Sign and SecurityPolicy.None", () => {
        const options = getOptions();
        should(() => {
            server_endpoint.addEndpointDescription(MessageSecurityMode.Sign, SecurityPolicy.None, options);
        }).throwError();
    });
});

describe("OPCUAServerEndpoint#addStandardEndpointDescriptions", function (this: Mocha.Suite) {
    let server_endpoint: OPCUAServerEndPoint;
    before(async () => {
        await extractFullyQualifiedDomainName();
    });
    let certificateManager: OPCUACertificateManager;
    before(async () => {
        certificateManager = new OPCUACertificateManager({});
    });
    after(() => {
        certificateManager.dispose();
    });

    beforeEach(() => {
        server_endpoint = new OPCUAServerEndPoint({
            port: port,
            serverInfo: new ApplicationDescription({}),
            certificateManager,
            certificateChain,
            privateKey: invalidPrivateKey
        });
        server_endpoint.addStandardEndpointDescriptions();
    });

    it("should find a endpoint matching MessageSecurityMode.None", () => {
        const endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.None, SecurityPolicy.None, null);
        should(endpoint_desc).be.instanceOf(EndpointDescription);
    });

    it_with_crypto("should find a endpoint matching SignAndEncrypt / Basic256Sha256", () => {
        const endpoint_desc = server_endpoint.getEndpointDescription(
            MessageSecurityMode.SignAndEncrypt,
            SecurityPolicy.Basic256Sha256,
            null
        );
        should(endpoint_desc).be.instanceof(EndpointDescription);
    });
    it_with_crypto("should find a endpoint matching SIGN / Basic256Sha256", () => {
        const endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.Sign, SecurityPolicy.Basic256Sha256, null);
        should(endpoint_desc).be.instanceof(EndpointDescription);
    });
});

describe("OPCUAServerEndpoint#addStandardEndpointDescriptions extra secure", function (this: Mocha.Suite) {
    let certificateManager: OPCUACertificateManager;
    before(async () => {
        certificateManager = new OPCUACertificateManager({});
    });
    after(() => {
        certificateManager.dispose();
    });

    let server_endpoint: OPCUAServerEndPoint;
    beforeEach(() => {
        server_endpoint = new OPCUAServerEndPoint({
            port: port,
            serverInfo: new ApplicationDescription({}),
            certificateManager,
            certificateChain,
            privateKey: invalidPrivateKey
        });
        server_endpoint.addStandardEndpointDescriptions({
            securityModes: [MessageSecurityMode.SignAndEncrypt],
            disableDiscovery: true
        });
    });

    it("should not find a endpoint matching MessageSecurityMode.None", () => {
        const endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.None, SecurityPolicy.None, null);
        should(endpoint_desc).be.eql(null);
    });

    it_with_crypto("should not find a endpoint matching Sign / Basic256Sha256", () => {
        const endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.Sign, SecurityPolicy.Basic256Sha256, null);
        should(endpoint_desc).be.eql(null);
    });

    it_with_crypto("should find a endpoint matching SignAndEncrypt / Basic256Sha256", () => {
        const endpoint_desc = server_endpoint.getEndpointDescription(
            MessageSecurityMode.SignAndEncrypt,
            SecurityPolicy.Basic256Sha256,
            null
        );
        should(endpoint_desc).be.instanceof(EndpointDescription);

        endpoint_desc?.userIdentityTokens?.length.should.be.greaterThan(1);
    });
});
describe("OPCUAServerEndpoint#addStandardEndpointDescriptions extra secure", function (this: Mocha.Suite) {
    let certificateManager: OPCUACertificateManager;
    before(async () => {
        certificateManager = new OPCUACertificateManager({});
    });
    after(() => {
        certificateManager.dispose();
    });

    let server_endpoint: OPCUAServerEndPoint;
    beforeEach(() => {
        server_endpoint = new OPCUAServerEndPoint({
            port: port,
            serverInfo: new ApplicationDescription({}),
            certificateManager,
            certificateChain,
            privateKey: invalidPrivateKey
        });
        server_endpoint.addStandardEndpointDescriptions({
            securityModes: [MessageSecurityMode.SignAndEncrypt],
            disableDiscovery: true,
            userTokenTypes: [] //<< NO USER TOKENS => SESSION NOT ALLOWED !
        });
    });

    it_with_crypto("should find a endpoint matching SignAndEncrypt / Basic256Sha256", () => {
        const endpoint_desc = server_endpoint.getEndpointDescription(
            MessageSecurityMode.SignAndEncrypt,
            SecurityPolicy.Basic256Sha256,
            null
        );
        should(endpoint_desc).be.instanceof(EndpointDescription);

        endpoint_desc?.userIdentityTokens?.length.should.eql(0);
    });
});

describe("OPCUAServerEndpoint#getEndpointDescription", function (this: Mocha.Suite) {
    let certificateManager: OPCUACertificateManager;
    before(async () => {
        certificateManager = new OPCUACertificateManager({});
    });
    after(() => {
        certificateManager.dispose();
    });

    let server_endpoint: OPCUAServerEndPoint;
    beforeEach(() => {
        server_endpoint = new OPCUAServerEndPoint({
            port: port,
            serverInfo: new ApplicationDescription({}),
            certificateManager,
            certificateChain,
            privateKey: invalidPrivateKey
        });
    });

    it_with_crypto("should not find a endpoint matching MessageSecurityMode.SIGN and SecurityPolicy.Basic128", () => {
        const options = getOptions();

        let endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.Sign, SecurityPolicy.Basic128, null);
        should(endpoint_desc).be.eql(null);

        server_endpoint.addEndpointDescription(MessageSecurityMode.Sign, SecurityPolicy.Basic128, options);
        server_endpoint.addEndpointDescription(MessageSecurityMode.Sign, SecurityPolicy.Basic256, options);

        endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.Sign, SecurityPolicy.Basic128, null);
        should(endpoint_desc).be.instanceof(EndpointDescription);

        endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.Sign, SecurityPolicy.Basic256, null);
        should(endpoint_desc).be.instanceof(EndpointDescription);
    });

    it("should not find a endpoint matching MessageSecurityMode.Sign and SecurityPolicy.None", () => {
        const endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.Sign, SecurityPolicy.None, null);
        should(endpoint_desc).be.eql(null);
    });
    it("should not find a endpoint matching MessageSecurityMode.SignAndEncrypt and SecurityPolicy.None", () => {
        const endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.SignAndEncrypt, SecurityPolicy.None, null);
        should(endpoint_desc).be.eql(null);
    });
});

const samplesCertFolder = path.join(__dirname, "../../node-opcua-samples/certificates");
const certFile2048 = path.join(samplesCertFolder, "server_cert_2048.pem");
const certFile1024 = path.join(samplesCertFolder, "server_cert_1024.pem");

// All tests require real DER certificates (combine_der validates ASN.1 structure).
const hasSampleCerts = fs.existsSync(certFile2048) && fs.existsSync(certFile1024);

describe("OPCUAServerEndPoint certificate provider", function (this: Mocha.Suite) {
    let certificateManager: OPCUACertificateManager;
    let server_endpoint: OPCUAServerEndPoint;
    let cert2048Chain: Certificate[];
    let cert1024Chain: Certificate[];

    before(async function () {
        if (!hasSampleCerts) {
            this.skip();
            return;
        }
        await extractFullyQualifiedDomainName();
        certificateManager = new OPCUACertificateManager({});
        cert2048Chain = readCertificateChain(certFile2048);
        cert1024Chain = readCertificateChain(certFile1024);
    });
    after(() => {
        if (hasSampleCerts) {
            certificateManager.dispose();
        }
    });

    beforeEach(() => {
        server_endpoint = new OPCUAServerEndPoint({
            port: port,
            serverInfo: new ApplicationDescription({}),
            certificateManager,
            certificateChain: cert1024Chain,
            privateKey: invalidPrivateKey
        });
    });

    it("should return initial chain from getCertificateChain()", () => {
        server_endpoint.getCertificateChain().length.should.eql(cert1024Chain.length);
        Buffer.compare(server_endpoint.getCertificate(), cert1024Chain[0]).should.eql(0);
    });

    it("should reflect a new chain after provider.update()", () => {
        const provider = server_endpoint.getCertificateProvider() as StaticCertificateChainProvider;
        provider.update(cert2048Chain);
        server_endpoint.invalidateCombinedDerCache();

        const chain = server_endpoint.getCertificateChain();
        chain.length.should.eql(cert2048Chain.length);
        Buffer.compare(chain[0], cert2048Chain[0]).should.eql(0);
    });

    it("should reflect a new chain after setCertificateProvider()", () => {
        const newProvider = new StaticCertificateChainProvider(cert2048Chain, invalidPrivateKey);
        server_endpoint.setCertificateProvider(newProvider);

        Buffer.compare(server_endpoint.getCertificate(), cert2048Chain[0]).should.eql(0);
    });

    it("should update serverCertificate dynamically on endpoint descriptions", () => {
        // Add a None endpoint
        const options = getOptions();
        server_endpoint.addEndpointDescription(MessageSecurityMode.None, SecurityPolicy.None, options);
        const endpoints = server_endpoint.endpointDescriptions();
        endpoints.length.should.be.greaterThan(0);

        // Before update: should have 1024 cert
        const before = endpoints[0].serverCertificate;
        should.exist(before, "initial serverCertificate must be set");

        // Update provider
        const provider = server_endpoint.getCertificateProvider() as StaticCertificateChainProvider;
        provider.update(cert2048Chain);
        server_endpoint.invalidateCombinedDerCache();

        // After: serverCertificate should dynamically reflect the new chain
        const expected = combine_der(cert2048Chain);
        for (const ep of endpoints) {
            const cert = ep.serverCertificate;
            should.exist(cert, "serverCertificate should be set");
            if (!cert) continue;
            cert.length.should.eql(expected.length);
            Buffer.compare(cert, expected).should.eql(0);
        }
    });

    it("should throw when StaticCertificateChainProvider.update() gets an empty chain", () => {
        const provider = server_endpoint.getCertificateProvider() as StaticCertificateChainProvider;
        should(() => {
            provider.update([]);
        }).throwError(/chain must not be empty/);
    });
});

type MockServerEndPoint = Pick<OPCUAServerEndPoint, "endpointDescriptions">;

function mockServerEndpoint(...urls: string[]): MockServerEndPoint {
    return {
        endpointDescriptions: (): EndpointDescription[] =>
            urls.map((u) => ({ endpointUrl: u }) as unknown as EndpointDescription)
    };
}

describe("OPCUABaseServer#getDiscoveryUrls", function (this: Mocha.Suite) {
    function makeServer(...eps: MockServerEndPoint[]): OPCUABaseServer {
        const server = Object.create(OPCUABaseServer.prototype) as OPCUABaseServer;
        server.endpoints = eps as OPCUAServerEndPoint[];
        return server;
    }

    it("should return unique URLs across all endpoint descriptions", () => {
        const server = makeServer(
            mockServerEndpoint("opc.tcp://host1:4840", "opc.tcp://host2:4840"),
            mockServerEndpoint("opc.tcp://host1:4840", "opc.tcp://host3:4840") // host1 is a duplicate
        );

        const urls = server.getDiscoveryUrls();
        urls.should.deepEqual(["opc.tcp://host1:4840", "opc.tcp://host2:4840", "opc.tcp://host3:4840"]);
    });

    it("should skip empty endpoint URLs", () => {
        const server = makeServer(mockServerEndpoint("opc.tcp://host1:4840", "", null as unknown as string));

        const urls = server.getDiscoveryUrls();
        urls.should.deepEqual(["opc.tcp://host1:4840"]);
    });

    it("should return empty array when no endpoints exist", () => {
        const server = makeServer();

        const urls = server.getDiscoveryUrls();
        urls.should.deepEqual([]);
    });
});
