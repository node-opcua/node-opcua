import "mocha";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import { getDefaultCertificateManager } from "../source/index.js";

// A user certificate is an identity claim: the certificate CommonName becomes the user
// name for the role lookup. The default user PKI must therefore not accept an unknown
// certificate, or any self-signed certificate would log in as the user named in its
// CommonName.
// Application PKI is now secure by default, but can be overridden via NODE_OPCUA_AUTO_ACCEPT_CERTS

describe("getDefaultCertificateManager trust defaults", () => {
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
