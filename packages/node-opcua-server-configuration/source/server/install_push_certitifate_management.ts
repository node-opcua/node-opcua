import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";

import { assert } from "node-opcua-assert";

import {
    OPCUACertificateManager
} from "node-opcua-certificate-manager";
import {
    Certificate,
    convertPEMtoDER,
    makeSHA1Thumbprint,
    PrivateKeyPEM,
    split_der
} from "node-opcua-crypto";
import {
    ICertificateKeyPairProvider
} from "node-opcua-secure-channel";
import {
    OPCUAServer, OPCUAServerEndPoint
} from "node-opcua-server";
import {
    installPushCertificateManagement
} from "../push_certificate_manager_helpers";

export interface OPCUAServerPartial extends ICertificateKeyPairProvider {
    serverCertificateManager: OPCUACertificateManager;
    $$privateKeyPEM: PrivateKeyPEM;
    $$certificate?: Certificate;
    $$certificateChain: Certificate;
}

function getCertificate(this: OPCUAServerPartial): Certificate {
    if (!this.$$certificate) {

        const certificateChain = getCertificateChain.call(this);
        this.$$certificate = split_der(certificateChain)[0];
    }
    return this.$$certificate!;
}

function getCertificateChain(this: OPCUAServerPartial): Certificate {
    if (!this.$$certificateChain) {
        throw new Error("internal Error. cannot find $$certificateChain");
    }
    return this.$$certificateChain;
}

function getPrivateKey(this: OPCUAServerPartial): PrivateKeyPEM {
    if (!this.$$privateKeyPEM) {
        throw new Error("internal Error. cannot find $$privateKeyPEM");
    }
    return this.$$privateKeyPEM;
}

async function install(this: OPCUAServerPartial): Promise<void> {
    if (!this.$$privateKeyPEM) {
        this.$$privateKeyPEM =
          await promisify(fs.readFile)(this.serverCertificateManager.privateKey, "utf8");
    }
    if (!this.$$certificateChain) {

        const certificateFile = path.join(this.serverCertificateManager.rootDir, "own/certs/certificate.pem");
        const exists = await (promisify(fs.exists)(certificateFile));
        if (!exists) {

            // this is the first time server is launch
            // let's create a default self signed certificate with limited validity

            const options = {
                applicationUri: "MY:APPLICATION:URI",
                dns: [
                    "localhost",
                    "my.domain.com"
                ],
                ip: [
                    "192.123.145.121"
                ],
                subject: "/CN=MyCommonName",

                startDate: new Date(),
                validity: 365 * 1, // one year
                /* */
                outputFile: certificateFile

            };
            await this.serverCertificateManager.createSelfSignedCertificate(options);

        }
        const certificatePEM =
          await promisify(fs.readFile)(certificateFile, "utf8");
        this.$$certificateChain = convertPEMtoDER(certificatePEM);

    }
}

function getCertificateChainEP(this: OPCUAServerEndPoint): Certificate {

    const certificateFile = path.join(this.certificateManager.rootDir, "own/certs/certificate.pem");
    const certificatePEM = fs.readFileSync(certificateFile, "utf8");
    const $$certificateChain = convertPEMtoDER(certificatePEM);
    const thumbprint = makeSHA1Thumbprint($$certificateChain);

    return $$certificateChain;
}

function getPrivateKeyEP(this: OPCUAServerEndPoint): PrivateKeyPEM {
    const $$privateKeyPEM = fs.readFileSync(this.certificateManager.privateKey, "utf8");
    return $$privateKeyPEM;
}

export async function installPushCertificateManagementOnServer(server: OPCUAServer): Promise<void> {

    if (!server.engine.addressSpace) {
        throw new Error("Server must have a valid address space." +
          "you need to call installPushCertificateManagementOnServer after server has been initialized");
    }
    await install.call(server as any as OPCUAServerPartial);

    server.getCertificate = getCertificate;
    server.getCertificateChain = getCertificateChain;
    server.getPrivateKey = getPrivateKey;

    for (const endpoint of server.endpoints) {

        const endpointPriv = endpoint as any;
        endpointPriv._certificateChain = null;
        endpointPriv._privateKey = null;

        endpoint.getCertificateChain = getCertificateChainEP;
        endpoint.getPrivateKey = getPrivateKeyEP;

        for (const e of endpoint.endpointDescriptions()) {
           // e.serverCertificate = null;
            (e as any).__defineGetter__("serverCertificate", function(this: any) {
                return endpoint.getCertificateChain();
            });
        }
    }

    await installPushCertificateManagement(
      server.engine.addressSpace, {
          applicationGroup: server.serverCertificateManager,
          userTokenGroup: server.userCertificateManager
      });

    const serverConfiguration = server.engine.addressSpace.rootFolder.objects.server.serverConfiguration;
    const serverConfigurationPriv = serverConfiguration as any;
    assert(serverConfigurationPriv.$pushCertificateManager);
    serverConfigurationPriv.$pushCertificateManager.on("CertificateChanged", async () => {
        const _server = server as any as OPCUAServerPartial;
        console.log("on CertificateChanged");

        _server.$$privateKeyPEM = fs.readFileSync(server.serverCertificateManager.privateKey, "utf8");
        const certificateFile = path.join(server.serverCertificateManager.rootDir, "own/certs/certificate.pem");
        const certificatePEM = fs.readFileSync(certificateFile, "utf8");
        _server.$$certificateChain = convertPEMtoDER(certificatePEM);
        _server.$$certificate = undefined;

        setTimeout(async () => {
            try {
                await server.shutdownChannels();
                console.log("channels have been closed -> client should reconnect ");

            } catch (err) {
                console.log("err = ", err);
            }
        }, 2000);
    });
}
