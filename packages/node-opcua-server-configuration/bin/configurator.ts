import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import util from "node:util";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import {
    AttributeIds,
    type IBasicSessionAsync,
    MessageSecurityMode,
    makeApplicationUrn,
    OPCUAClient,
    resolveNodeId,
    SecurityPolicy,
    UserTokenType
} from "node-opcua-client";
import { readCertificateChain, readCertificateChainAsync, readCertificateRevocationList } from "node-opcua-crypto";
import { exploreCertificate, exploreCertificateSigningRequest, makeSHA1Thumbprint, readCertificateChain, readCertificateChainAsync, split_der, toPem, type Certificate } from "node-opcua-crypto/web";
import { CertificateAuthority } from "node-opcua-pki";
import type { TrustListDataType } from "node-opcua-types";
import { CertificateType, ClientPushCertificateManagement } from "..";

const endpointUrl = "opc.tcp://localhost:48010";

function dumpCertificateInfo(certificate: Certificate) {
    console.log("thumbprint ", makeSHA1Thumbprint(certificate).toString("hex").toUpperCase());
    const i = exploreCertificate(certificate);
    console.log(" serial number       : ", i.tbsCertificate.serialNumber);
    console.log(" subject             : ");
    for (const [k, v] of Object.entries(i.tbsCertificate.subject)) {
        console.log(`   ${k.padEnd(18)}: ${v}`);
    }
    console.log(" notBefore           : ", i.tbsCertificate.validity.notBefore);
    console.log(" notAfter            : ", i.tbsCertificate.validity.notAfter);
    console.log(" issuer              : ");
    for (const [k, v] of Object.entries(i.tbsCertificate.issuer)) {
        console.log(`   ${k.padEnd(18)}: ${v}`);
    }
    console.log(" signature algo      : ", i.signatureAlgorithm);
}

async function dumpTrustedList(trustList: TrustListDataType) {
    if (trustList.trustedCertificates?.length) {
        console.log("number of trusted certificates", trustList.trustedCertificates.length);
        for (const certificate of trustList.trustedCertificates) {
            dumpCertificateInfo(certificate);
        }
    }
    if (trustList.issuerCertificates?.length) {
        console.log("number of issuers certificates", trustList.issuerCertificates.length);
        for (const certificate of trustList.issuerCertificates) {
            dumpCertificateInfo(certificate);
        }
    }
}
async function dumpApplicationTrustedCertificates(session: IBasicSessionAsync) {
    const s = new ClientPushCertificateManagement(session);
    const applicationGroup = await s.getCertificateGroup("DefaultApplicationGroup");

    const trustList = await applicationGroup.getTrustList();
    const tl = await trustList.readTrustedCertificateList();
    dumpTrustedList(tl);
}

async function dumpUserTokenTrustedCertificates(session: IBasicSessionAsync) {
    const s = new ClientPushCertificateManagement(session);
    const applicationGroup = await s.getCertificateGroup("DefaultUserTokenGroup");

    const trustList = await applicationGroup.getTrustList();
    const tl = await trustList.readTrustedCertificateList();
    dumpTrustedList(tl);
}

async function getRejectedList(session: IBasicSessionAsync) {
    const s = new ClientPushCertificateManagement(session);
    const rejectedList = await s.getRejectedList();
    if (rejectedList.statusCode.isNotGood()) {
        throw new Error(rejectedList.statusCode.name);
    }

    console.log("number of rejected certificates ", rejectedList.certificates?.length);
    for (const certificate of rejectedList.certificates || []) {
        dumpCertificateInfo(certificate);
    }
}

async function dumpServerConfiguration(session: IBasicSessionAsync) {
    const capabilitiesDataValue = await session.read({
        nodeId: resolveNodeId("ServerConfiguration_ServerCapabilities"),
        attributeId: AttributeIds.Value
    });
    const capabilities = capabilitiesDataValue.value.value as string[];
    console.log(" server capabilities  : ", capabilities.join(","));

    const multicastDnsEnabledDataValue = await session.read({
        nodeId: resolveNodeId("ServerConfiguration_MulticastDnsEnabled"),
        attributeId: AttributeIds.Value
    });
    const multicastDnsEnabled = multicastDnsEnabledDataValue.value.value as boolean;
    console.log(" multicastDns enabled : ", multicastDnsEnabled);

    const maxTrustListSizeDataValue = await session.read({
        nodeId: resolveNodeId("ServerConfiguration_MaxTrustListSize"),
        attributeId: AttributeIds.Value
    });
    const maxTrustListSize = maxTrustListSizeDataValue.value.value as number;
    console.log(" max trust list size  : ", maxTrustListSize);

    const supportedPrivateKeyFormatsDataValue = await session.read({
        nodeId: resolveNodeId("ServerConfiguration_SupportedPrivateKeyFormats"),
        attributeId: AttributeIds.Value
    });
    const supportedPrivateKeyFormats = supportedPrivateKeyFormatsDataValue.value.value as string[];
    console.log(" key format           : ", supportedPrivateKeyFormats.join(","));
    //
    await dumpApplicationTrustedCertificates(session);
    //
    await dumpUserTokenTrustedCertificates(session);
    //
    await getRejectedList(session);
}

async function addApplicationCertificate(session: IBasicSessionAsync) {
    const s = new ClientPushCertificateManagement(session);
    const ag = await s.getApplicationGroup();
    const trustList = await ag.getTrustList();

    const certificateFile = path.join(__dirname, "../../node-opcua-samples/certificates/client_cert_2048.pem");

    const certificate = await readCertificateChainAsync(certificateFile);
    await trustList.addCertificate(certificate, true);
}

async function addApplicationIssuerCertificateAndCRL(_session: IBasicSessionAsync) {
    /**
     */
}

export async function replaceServerCertificate(session: IBasicSessionAsync, caAuthority: CertificateAuthority) {
    const certificateAuthorityPath = path.join(caAuthority.location);
    const caCertificate = await readCertificateChainAsync(caAuthority.caCertificate);
    // also get crl
    const crl = await readCertificateRevocationList(caAuthority.revocationList);

    // get signing request
    const s = new ClientPushCertificateManagement(session);
    const _ag = await s.getApplicationGroup();
    const csr = await s.createSigningRequest("DefaultApplicationGroup", CertificateType.RsaSha256Application, "CN=toto", false);
    if (csr.statusCode.isNotGood()) {
        console.log("Signing Request = ", csr.statusCode.toString());
        throw new Error(csr.statusCode.name);
    }

    console.log(csr.certificateSigningRequest?.toString("base64"));

    const certificateFile = path.join(certificateAuthorityPath, "demo.pem");
    const csrFilename = path.join(certificateAuthorityPath, "csr.pem");
    if (!csr.certificateSigningRequest) {
        throw new Error("certificateSigningRequest is undefined");
    }
    fs.writeFileSync(csrFilename, toPem(csr.certificateSigningRequest, "CERTIFICATE REQUEST"));

    const certificateRequestInfo = exploreCertificateSigningRequest(csr.certificateSigningRequest);
    console.log(util.inspect(certificateRequestInfo, { depth: 10 }));

    const applicationUri = certificateRequestInfo.extensionRequest.subjectAltName.uniformResourceIdentifier[0];
    console.log("applicationUri = ", applicationUri);
    await caAuthority.signCertificateRequest(certificateFile, csrFilename, {
        startDate: new Date(),
        endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10),
        reason: "Signature by me",
        applicationUri
    });

    const certificateChain = readCertificateChain(certificateFile);
    dumpCertificateInfo(certificateChain);

    // now publish certificate

    const certificates = split_der(certificateChain);

    const a = await s.getApplicationGroup();
    const tl = await a.getTrustList();
    tl.addCertificate(caCertificate, false);

    const result = await s.updateCertificate("DefaultApplicationGroup", CertificateType.RsaSha256Application, certificates[0], [
        certificates[1],
        crl
    ]);
    if (result.statusCode.isNotGood()) {
        throw new Error(`updateCertificate failed ${csr.statusCode.name}`);
    }
    if (result.applyChangesRequired) {
        console.log("Applying changes");
        const statusCode = await s.applyChanges();
        if (statusCode.isNotGood()) {
            throw new Error(`applyChanged failed ${csr.statusCode.name}`);
        }
    }
}
(async () => {
    try {
        const configFolder = path.join(__dirname, "../temp/aa");
        if (!fs.existsSync(configFolder)) {
            fs.mkdirSync(configFolder);
        }

        // --------------------------------------------------------------- CA Authority
        const certificateAutorityhPath = path.join(configFolder, "CA");
        const caAuthority = new CertificateAuthority({
            location: certificateAutorityhPath,
            keySize: 4096
        });
        await caAuthority.initialize();
        await caAuthority.constructCACertificateWithCRL();
        const caCertificate = await readCertificateChainAsync(caAuthority.caCertificate);
        const crl = await readCertificateRevocationList(caAuthority.revocationList);

        // --------------------------------------------------------------- Client PKI
        const hostname = os.hostname();
        const applicationUri = makeApplicationUrn(hostname, "Client");

        const pkiPath = path.join(configFolder, "PKI");
        const clientCertificateManager = new OPCUACertificateManager({
            automaticallyAcceptUnknownCertificate: true,
            rootFolder: pkiPath,
            keySize: 4096
        });
        await clientCertificateManager.initialize();
        const certificateFile = path.join(clientCertificateManager.rootDir, "own/certs/client_certificate.pem");
        if (!fs.existsSync(certificateFile)) {
            await clientCertificateManager.createSelfSignedCertificate({
                applicationUri,
                startDate: new Date(),
                endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
                validity: 365,
                subject: "CN=Sterfive",
                dns: [hostname],
                outputFile: certificateFile
            });
        }

        // ------------------------------------------------------------------- Add CA Certificate to Client PKI
        console.log(caCertificate.toString("base64"));
        await clientCertificateManager.addIssuer(caCertificate, false, true);
        await clientCertificateManager.addRevocationList(crl);

        const client = OPCUAClient.create({
            applicationUri,
            endpointMustExist: false,
            connectionStrategy: {
                maxRetry: 1
            },
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256,

            clientCertificateManager,
            certificateFile
        });

        await client.withSessionAsync(
            {
                endpointUrl,
                userIdentity: {
                    type: UserTokenType.UserName,
                    userName: "root",
                    password: (() => "secret")()
                }
            },
            async (session) => {
                try {
                    await dumpServerConfiguration(session);

                    // add application certificate

                    await addApplicationCertificate(session);

                    await dumpServerConfiguration(session);

                    // add issuer certificate + crl
                    await addApplicationIssuerCertificateAndCRL(session);

                    // await replaceServerCertificate(session, caAuthority);

                    console.log("done");
                } catch (err) {
                    if (util.types.isNativeError(err)) {
                        console.log("Error ", err.message);
                    }
                    console.log(err);
                }
            }
        );
    } catch (err) {
        if (util.types.isNativeError(err)) {
            console.log("Error ", err.message);
        }
        console.log(err);
    }
})();
