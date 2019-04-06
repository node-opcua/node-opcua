import * as path from "path";

import { CertificateManager } from "node-opcua-pki";
import { PushCertificateManagerServerImpl } from "../../source/server/push_certificate_manager_server_impl";

describe("Testing Server Side PushCertificateManager", () => {

    const _tempFolder = path.join(__dirname, "../../temp");
    let  pushManager: PushCertificateManagerServerImpl;
    before(async () => {

        const applicationGroup = new CertificateManager({
            location: path.join(_tempFolder, "application")
        });
        const userTokenGroup = new CertificateManager({
            location: path.join(_tempFolder, "user")
        });
        pushManager = new PushCertificateManagerServerImpl({
            applicationGroup,
            userTokenGroup,
        });

        await pushManager.initialize();


    });

    it("should expose support format", async () => {
        const supportedPrivateKeyFormats = await pushManager.getSupportedPrivateKeyFormats();
        supportedPrivateKeyFormats.should.eql(["PEM"]);
    });

    it("should create a certificate signing request - simple form", async () => {
        await pushManager.createSigningRequest(
          "DefaultApplicationGroup",
          "",
          "L=NOM",
          false,
          Buffer.alloc(0)
        );
    });

});
