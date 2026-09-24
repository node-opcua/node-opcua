import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { readCertificateChain } from "node-opcua-crypto";
import { messageLogger } from "node-opcua-debug";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import sinon from "sinon";
import { findEndpointHostMissingFromCertificate, OPCUABaseServer } from "../source/base_server.js";

// OPC 10000-4 v1.05.07 5.6.2.1 (OpenSecureChannel): "Servers shall add all possible
// HostNames like MyHost and MyHost.mycompany.com into the Server Certificate. This
// includes IP addresses of the host or the HostName exposed by a NAT router used to
// connect to the Server." and "a Client shall verify the HostName specified in the
// Server Certificate is the same as the HostName contained in the endpointUrl."
//
// A server whose certificate only lists its container hostname, reached by clients
// through the host's public address, only shows up on the client side as
// Bad_CertificateHostNameInvalid. This warns on the server side instead.

const knownDnsHost = "myserver.example.com";
const knownIp = "203.0.113.5";
const unknownDnsHost = "other.example.com";
const unknownIp = "198.51.100.7";

const tmpDir = path.join(os.tmpdir(), `test-endpoint-host-cert-warning-${process.pid}`);

async function makeCertificate(): Promise<Buffer> {
    const cm = new OPCUACertificateManager({
        rootFolder: tmpDir,
        automaticallyAcceptUnknownCertificate: true
    });
    await cm.initialize();
    const outputFile = path.join(tmpDir, "own/certs/certificate.pem");
    await cm.createSelfSignedCertificate({
        applicationUri: "urn:test:endpoint-host-cert-warning",
        dns: [knownDnsHost],
        ip: [knownIp],
        outputFile,
        startDate: new Date(),
        subject: "/CN=EndpointHostCertWarningTest",
        validity: 365
    });
    cm.dispose();
    return readCertificateChain(outputFile)[0];
}

function makeBaseServer(certificate: Buffer): OPCUABaseServer {
    const baseServer = Object.create(OPCUABaseServer.prototype) as OPCUABaseServer;
    (baseServer as unknown as { getCertificate: () => Buffer }).getCertificate = () => certificate;
    return baseServer;
}

function warnIfEndpointHostNotInCertificate(server: OPCUABaseServer, endpointUrl: string | null | undefined): void {
    (
        server as unknown as {
            _warnIfEndpointHostNotInCertificate: (endpointUrl: string | null | undefined) => void;
        }
    )._warnIfEndpointHostNotInCertificate(endpointUrl);
}

function setServerCertificate(server: OPCUABaseServer, certificate: Buffer): void {
    (server as unknown as { getCertificate: () => Buffer }).getCertificate = () => certificate;
}

// _findEndpointHostMissingFromCertificate() is the protected seam
// _warnIfEndpointHostNotInCertificate() calls for its (otherwise uncacheable) ASN.1
// parse: spying on it, rather than on the exported pure function directly, proves how
// many times the expensive check actually ran without having to intercept an ESM export.
function spyOnMissingHostCheck(server: OPCUABaseServer): sinon.SinonSpy {
    return sinon.spy(
        server as unknown as {
            _findEndpointHostMissingFromCertificate: (endpointUrl: string, certificate: Buffer) => string | null;
        },
        "_findEndpointHostMissingFromCertificate"
    );
}

describe("findEndpointHostMissingFromCertificate", function (this: Mocha.Suite) {
    this.timeout(30000);

    let certificate: Buffer;

    before(async () => {
        certificate = await makeCertificate();
    });

    after(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("returns null when the host is covered by a dNSName SAN entry, case-insensitively", () => {
        should(findEndpointHostMissingFromCertificate(`opc.tcp://${knownDnsHost}:4840`, certificate)).eql(null);
        should(findEndpointHostMissingFromCertificate(`opc.tcp://${knownDnsHost.toUpperCase()}:4840`, certificate)).eql(null);
    });

    it("returns null when the host is an IPv4 address covered by an iPAddress SAN entry", () => {
        should(findEndpointHostMissingFromCertificate(`opc.tcp://${knownIp}:4840`, certificate)).eql(null);
    });

    it("returns the host when it is a DNS name not covered by any SAN entry", () => {
        should(findEndpointHostMissingFromCertificate(`opc.tcp://${unknownDnsHost}:4840`, certificate)).eql(unknownDnsHost);
    });

    it("returns the host when it is an IPv4 address not covered by any SAN entry", () => {
        should(findEndpointHostMissingFromCertificate(`opc.tcp://${unknownIp}:4840`, certificate)).eql(unknownIp);
    });

    it("returns null for localhost", () => {
        should(findEndpointHostMissingFromCertificate("opc.tcp://localhost:4840", certificate)).eql(null);
    });

    it("returns null for 127.0.0.1 (127.0.0.0/8 loopback)", () => {
        should(findEndpointHostMissingFromCertificate("opc.tcp://127.0.0.1:4840", certificate)).eql(null);
        should(findEndpointHostMissingFromCertificate("opc.tcp://127.42.0.9:4840", certificate)).eql(null);
    });

    it("returns null for ::1 (IPv6 literals are not checked)", () => {
        should(findEndpointHostMissingFromCertificate("opc.tcp://[::1]:4840", certificate)).eql(null);
    });

    it("returns null for an unrelated IPv6 literal (IPv6 literals are not checked)", () => {
        should(findEndpointHostMissingFromCertificate("opc.tcp://[2001:db8::1]:4840", certificate)).eql(null);
    });

    it("returns null when the endpointUrl is empty or missing", () => {
        should(findEndpointHostMissingFromCertificate("", certificate)).eql(null);
        should(findEndpointHostMissingFromCertificate(null, certificate)).eql(null);
        should(findEndpointHostMissingFromCertificate(undefined, certificate)).eql(null);
    });

    it("returns null when the endpointUrl cannot be parsed", () => {
        should(findEndpointHostMissingFromCertificate("not-an-url", certificate)).eql(null);
    });
});

describe("OPCUABaseServer#_warnIfEndpointHostNotInCertificate", function (this: Mocha.Suite) {
    this.timeout(30000);

    let certificate: Buffer;

    before(async () => {
        certificate = await makeCertificate();
    });

    after(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("logs NODE-OPCUA-W27 once for a host missing from the certificate, and stays quiet for a covered host", () => {
        const server = makeBaseServer(certificate);
        const spyFunc = sinon.spy();
        messageLogger.on("warningMessage", spyFunc);
        try {
            warnIfEndpointHostNotInCertificate(server, `opc.tcp://${unknownDnsHost}:4840`);
            warnIfEndpointHostNotInCertificate(server, `opc.tcp://${unknownDnsHost}:4840`);
            warnIfEndpointHostNotInCertificate(server, `opc.tcp://${knownDnsHost}:4840`);
        } finally {
            messageLogger.removeListener("warningMessage", spyFunc);
        }

        const messages = spyFunc.getCalls().map((call) => call.args[0] as string);
        const matching = messages.filter((msg) => msg.includes("[NODE-OPCUA-W27]"));

        should(matching.length).eql(1);
        should(matching[0]).match(new RegExp(`"${unknownDnsHost}"`));
    });

    it("stops warning once 20 distinct hosts have been reported", () => {
        const server = makeBaseServer(certificate);
        const spyFunc = sinon.spy();
        messageLogger.on("warningMessage", spyFunc);
        try {
            for (let i = 0; i < 25; i++) {
                warnIfEndpointHostNotInCertificate(server, `opc.tcp://unknown-host-${i}.example.com:4840`);
            }
        } finally {
            messageLogger.removeListener("warningMessage", spyFunc);
        }

        const messages = spyFunc.getCalls().map((call) => call.args[0] as string);
        const matching = messages.filter((msg) => msg.includes("[NODE-OPCUA-W27]"));

        should(matching.length).eql(20);
    });

    it("computes the verdict only once for a host checked twice, whether covered or missing", () => {
        const server = makeBaseServer(certificate);
        const spy = spyOnMissingHostCheck(server);

        // OPC 10000-4 v1.05.07 5.5.4.1: GetEndpoints "should minimize the amount of
        // processing required to send the response" - a correctly covered host must
        // not be re-parsed on every call either.
        warnIfEndpointHostNotInCertificate(server, `opc.tcp://${knownDnsHost}:4840`);
        warnIfEndpointHostNotInCertificate(server, `opc.tcp://${knownDnsHost}:4840`);
        should(spy.callCount).eql(1);

        warnIfEndpointHostNotInCertificate(server, `opc.tcp://${unknownDnsHost}:4840`);
        warnIfEndpointHostNotInCertificate(server, `opc.tcp://${unknownDnsHost}:4840`);
        should(spy.callCount).eql(2);
    });

    it("re-checks a host, and warns again, once the certificate changes", async () => {
        const otherCertificate = await makeCertificate();
        should(otherCertificate).not.eql(certificate);

        const server = makeBaseServer(certificate);
        const spy = spyOnMissingHostCheck(server);
        const spyFunc = sinon.spy();
        messageLogger.on("warningMessage", spyFunc);
        try {
            warnIfEndpointHostNotInCertificate(server, `opc.tcp://${unknownDnsHost}:4840`);
            warnIfEndpointHostNotInCertificate(server, `opc.tcp://${unknownDnsHost}:4840`);
            should(spy.callCount).eql(1);

            // swap in a different certificate object (still missing the host): the
            // cache is keyed on that Buffer, so this must be treated as unseen again.
            setServerCertificate(server, otherCertificate);
            warnIfEndpointHostNotInCertificate(server, `opc.tcp://${unknownDnsHost}:4840`);
            should(spy.callCount).eql(2);
        } finally {
            messageLogger.removeListener("warningMessage", spyFunc);
        }

        const messages = spyFunc.getCalls().map((call) => call.args[0] as string);
        const matching = messages.filter((msg) => msg.includes("[NODE-OPCUA-W27]"));
        should(matching.length).eql(2);
    });
});
