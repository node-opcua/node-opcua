import {
    AddressSpace,
    generateAddressSpace,
    IServerBase, ISessionBase,
    PseudoSession,
    SessionContext
} from "node-opcua-address-space";
import { NodeClass } from "node-opcua-data-model";
import { nodesets } from "node-opcua-nodesets";

import { NodeId } from "node-opcua-nodeid";
import { ClientPullCertificateManagement, installPushCertificateManagement } from "../source";
import { StatusCodes } from "node-opcua-status-code";
import { UserNameIdentityToken } from "node-opcua-types";

describe("ServerConfiguration", () => {

    let addressSpace: AddressSpace;

    const xmlFiles = [
        nodesets.standard
    ];
    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, xmlFiles);

    });
    after(() => {
        addressSpace.dispose();
    });


    it("should expose a server configuration object", async () => {
        const server = addressSpace.rootFolder.objects.server;
        server.should.have.ownProperty("serverConfiguration");
    });

    it("should expose a server configuration object - Certificate Management", async () => {

        const server = addressSpace.rootFolder.objects.server;

        // folders
        server.serverConfiguration.should.have.ownProperty("certificateGroups");

        // properties
        server.serverConfiguration.should.have.ownProperty("maxTrustListSize");
        server.serverConfiguration.should.have.ownProperty("multicastDnsEnabled");
        server.serverConfiguration.should.have.ownProperty("serverCapabilities");
        server.serverConfiguration.should.have.ownProperty("supportedPrivateKeyFormats");

        // methods
        server.serverConfiguration.should.have.ownProperty("applyChanges");
        server.serverConfiguration.should.have.ownProperty("createSigningRequest");
        server.serverConfiguration.should.have.ownProperty("getRejectedList");
        server.serverConfiguration.should.have.ownProperty("updateCertificate");

    });

    it("server configuration should make its first level object visible", () => {
        // ServerConfiguration Object and its immediate children shall be visible (i.e. browse access is available) to
        // users who can access the Server Object.
        // todo
    });
    it("server configuration should hide children of certificate groups to non admin user", () => {
        // The children of the CertificateGroups Object should
        // only be visible to authorized administrators.
        // todo
    });

    it("should expose a server configuration object - KeyCredential Management", async () => {
        const server = addressSpace.rootFolder.objects.server;
        server.serverConfiguration.should.have.ownProperty("keyCredentialConfiguration");
    });
    it("should expose a server configuration object - Authorization Management", async () => {
        const server = addressSpace.rootFolder.objects.server;
        server.serverConfiguration.should.have.ownProperty("authorizationServices");
    });

    describe("Push Certificate Management model", () => {
        //
        // from OpcUA Specification part#12 7.3:
        // Push management is targeted at Server applications to
        // get a Certificate Request which can be passed onto the CertificateManager.
        // After the CertificateManager signs the Certificate the new Certificate
        // is pushed to the Server with the UpdateCertificate Method

        // The Administration Component may be part of the CertificateManager or a standalone utility
        // that uses OPC UA to communicate with the CertificateManager.
        // The Configuration Database is used by the Server to persist its configuration information.
        // The RegisterApplication Method (or internal equivalent) is assumed to have been called
        // before the sequence in the diagram starts.
        // A similar process is used to renew certificates or to periodically update Trust List.
        // Security when using the Push Management Model requires an encrypted channel and the use
        // of Administrator credentials for the Server that ensure only authorized users can update
        // Certificates or Trust Lists. In addition, separate Administrator credentials are required for the
        // OPC Unified Architecture, Part 12 24 Release 1.04
        // CertificateManager that ensure only authorized users can register new Servers and request
        // new Certificates.

        it("should implement createSigningRequest", async () => {

            installPushCertificateManagement(addressSpace);

            const server = addressSpace.rootFolder.objects.server;
            server.serverConfiguration.createSigningRequest.nodeClass.should.eql(NodeClass.Method);

            const pseudoSession = new PseudoSession(addressSpace);
            const clientPullCertificateManager = new ClientPullCertificateManagement(pseudoSession);

            const certificateGroupId = await clientPullCertificateManager.getCertificateGroupId("DefaultApplicationGroup");
            const certificateTypeId = NodeId.nullNodeId;
            const subjectName = "SomeSubjectName";
            const regeneratePrivateKey = false;
            const nonce = Buffer.alloc(0);

            const result = await clientPullCertificateManager.createSigningRequest(
              certificateGroupId,
              certificateTypeId,
              subjectName,
              regeneratePrivateKey,
              nonce
            );
            result.statusCode.should.eql(StatusCodes.Good);

        });
        it("should implement UpdateCertificate", async () => {

            installPushCertificateManagement(addressSpace);

            const server: IServerBase = {
                userManager: {
                    getUserRole(userName: string): string {
                        return "admin";
                    }
                }
            };
            const session: ISessionBase = {
                userIdentityToken: new UserNameIdentityToken({
                    userName: "joedoe"
                })
            };

            const pseudoSession = new PseudoSession(addressSpace, server, session);
            const clientPullCertificateManager = new ClientPullCertificateManagement(pseudoSession);

            const certificateGroupId = NodeId.nullNodeId;
            const certificateTypeId = NodeId.nullNodeId;
            const certificate = Buffer.from("SomeCertificate");
            const issuerCertificates = [
                Buffer.from("Issuer1"),
                Buffer.from("Issuer2")
            ];
            const privateKeyFormat = "PEM";
            const privateKey = Buffer.from("1234");

            const result = await clientPullCertificateManager.updateCertificate(
              certificateGroupId,
              certificateTypeId,
              certificate,
              issuerCertificates,
              privateKeyFormat,
              privateKey
            );

            result.statusCode.should.eql(StatusCodes.Good);
            result.applyChangeRequired!.should.eql(true);

        });
    });

});
