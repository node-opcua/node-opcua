import "mocha";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { withEnv } from "node-opcua-test-helpers";
import should from "should";
import { defaultUserStoreWarning, getDefaultCertificateManager } from "../source/index.js";

// A user certificate is an identity claim: the certificate CommonName becomes the user
// name for the role lookup. The default user PKI must therefore not accept an unknown
// certificate, or any self-signed certificate would log in as the user named in its
// CommonName.
// Application PKI is now secure by default, but can be overridden via NODE_OPCUA_AUTO_ACCEPT_CERTS

describe("getDefaultCertificateManager trust defaults", () => {
    // Another suite running in the same process may have set NODE_OPCUA_AUTO_ACCEPT_CERTS:
    // unset it to exercise the secure default.
    withEnv("NODE_OPCUA_AUTO_ACCEPT_CERTS", undefined);

    it("creates the default user PKI with automaticallyAcceptUnknownCertificate = false", () => {
        const cm = getDefaultCertificateManager("UserPKI");
        try {
            should(cm.automaticallyAcceptUnknownCertificate).eql(false);
        } finally {
            cm.dispose();
        }
    });

    it("creates the default application PKI with automaticallyAcceptUnknownCertificate = false", () => {
        const cm = getDefaultCertificateManager("PKI");
        try {
            should(cm.automaticallyAcceptUnknownCertificate).eql(false);
        } finally {
            cm.dispose();
        }
    });
});

// Versions before 2.187.23 added every unknown user certificate to the default user
// PKI, and such a certificate stays trusted after an update. The default user PKI
// therefore reports, once per process, the certificates its trusted folder holds.
describe("defaultUserStoreWarning", () => {
    let pkiFolder: string;
    beforeEach(() => {
        pkiFolder = fs.mkdtempSync(path.join(os.tmpdir(), "user-pki-"));
    });
    afterEach(() => {
        fs.rmSync(pkiFolder, { recursive: true, force: true });
    });

    it("returns null when the trusted folder does not exist", () => {
        should(defaultUserStoreWarning(pkiFolder)).eql(null);
    });

    it("returns null when the trusted folder is empty", () => {
        fs.mkdirSync(path.join(pkiFolder, "trusted", "certs"), { recursive: true });
        should(defaultUserStoreWarning(pkiFolder)).eql(null);
    });

    it("ignores files that are not certificates", () => {
        const certs = path.join(pkiFolder, "trusted", "certs");
        fs.mkdirSync(certs, { recursive: true });
        fs.writeFileSync(path.join(certs, "readme.txt"), "");
        should(defaultUserStoreWarning(pkiFolder)).eql(null);
    });

    it("names the folder and the number of certificates", () => {
        const certs = path.join(pkiFolder, "trusted", "certs");
        fs.mkdirSync(certs, { recursive: true });
        fs.writeFileSync(path.join(certs, "admin[0123].pem"), "");
        fs.writeFileSync(path.join(certs, "operator[4567].der"), "");
        const warning = defaultUserStoreWarning(pkiFolder);
        should(warning).be.a.String();
        should(warning).match(/\[NODE-OPCUA-W40\]/);
        should(warning).containEql("holds 2 trusted certificate(s)");
        should(warning).containEql(certs);
    });
});
