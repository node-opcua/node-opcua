"use strict";

import should from "should";

import { invalidPrivateKey, SecurityPolicy } from "node-opcua-secure-channel";
import { MessageSecurityMode } from "node-opcua-secure-channel";
import { ApplicationDescription, EndpointDescription, UserTokenType } from "node-opcua-service-endpoints";
import { extractFullyQualifiedDomainName, getFullyQualifiedDomainName } from "node-opcua-hostname";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { OPCUAServerEndPoint } from "../source";

const it_with_crypto = it;

const port = 2042;

const certificateChain = Buffer.alloc(0);

function getOptions() {
    const options = {
        hostname: getFullyQualifiedDomainName(),
        securityPolicies: [SecurityPolicy.Basic256Sha256],
        userTokenTypes: [UserTokenType.UserName]
    };
    return options;
}
// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("OPCUAServerEndpoint#addEndpointDescription", function () {
    let server_endpoint: OPCUAServerEndPoint;
    let certificateManager: OPCUACertificateManager;
    before(async () => {
        await extractFullyQualifiedDomainName();
        certificateManager = new OPCUACertificateManager({});
    });
    after(() => {
        certificateManager.dispose();
    });

    beforeEach(function () {
        server_endpoint = new OPCUAServerEndPoint({
            port: port,
            serverInfo: new ApplicationDescription({}),
            certificateChain,
            privateKey: invalidPrivateKey,
            certificateManager
        });
    });

    const param = {};

    it("should  accept  to add endpoint endMessageSecurityMode.None and SecurityPolicy.None", function () {
        const options = getOptions();
        should(function () {
            server_endpoint.addEndpointDescription(MessageSecurityMode.None, SecurityPolicy.None, options);
        }).not.throwError();
    });

    it("should  accept  to add endpoint endMessageSecurityMode.None and SecurityPolicy.None twice", function () {
        const options = getOptions();
        server_endpoint.addEndpointDescription(MessageSecurityMode.None, SecurityPolicy.None, options);
        should(function () {
            server_endpoint.addEndpointDescription(MessageSecurityMode.None, SecurityPolicy.None, options);
        }).throwError();
    });

    it("should not accept to add endpoint with MessageSecurityMode.None and SecurityPolicy.Basic128", function () {
        const options = getOptions();
        should(function () {
            server_endpoint.addEndpointDescription(MessageSecurityMode.None, SecurityPolicy.Basic128, options);
        }).throwError();
    });
    it("should not accept  to add endpoint  MessageSecurityMode.Sign and SecurityPolicy.None", function () {
        const options = getOptions();
        should(function () {
            server_endpoint.addEndpointDescription(MessageSecurityMode.Sign, SecurityPolicy.None, options);
        }).throwError();
    });
});

describe("OPCUAServerEndpoint#addStandardEndpointDescriptions", function () {
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

    beforeEach(function () {
        server_endpoint = new OPCUAServerEndPoint({
            port: port,
            serverInfo: new ApplicationDescription({}),
            certificateManager,
            certificateChain,
            privateKey: invalidPrivateKey
        });
        server_endpoint.addStandardEndpointDescriptions();
    });

    it("should find a endpoint matching MessageSecurityMode.None", function () {
        const endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.None, SecurityPolicy.None, null);
        should(endpoint_desc).be.instanceOf(EndpointDescription);
    });

    it_with_crypto("should find a endpoint matching SIGNANDENCRYPT / Basic256", function () {
        const endpoint_desc = server_endpoint.getEndpointDescription(
            MessageSecurityMode.SignAndEncrypt,
            SecurityPolicy.Basic256,
            null
        );
        should(endpoint_desc).be.instanceof(EndpointDescription);
    });
    it_with_crypto("should find a endpoint matching SIGN / Basic256", function () {
        const endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.Sign, SecurityPolicy.Basic256, null);
        should(endpoint_desc).be.instanceof(EndpointDescription);
    });
});

describe("OPCUAServerEndpoint#addStandardEndpointDescriptions extra secure", function () {
    let certificateManager: OPCUACertificateManager;
    before(async () => {
        certificateManager = new OPCUACertificateManager({});
    });
    after(() => {
        certificateManager.dispose();
    });

    let server_endpoint: OPCUAServerEndPoint;
    beforeEach(function () {
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

    it("should not find a endpoint matching MessageSecurityMode.None", function () {
        const endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.None, SecurityPolicy.None, null);
        should(endpoint_desc).be.eql(null);
    });

    it_with_crypto("should not find a endpoint matching Sign / Basic256", function () {
        const endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.Sign, SecurityPolicy.Basic256, null);
        should(endpoint_desc).be.eql(null);
    });

    it_with_crypto("should find a endpoint matching SignAndEncrypt / Basic256", function () {
        const endpoint_desc = server_endpoint.getEndpointDescription(
            MessageSecurityMode.SignAndEncrypt,
            SecurityPolicy.Basic256,
            null
        );
        should(endpoint_desc).be.instanceof(EndpointDescription);

        endpoint_desc!.userIdentityTokens!.length.should.be.greaterThan(1);
    });
});
describe("OPCUAServerEndpoint#addStandardEndpointDescriptions extra secure", function () {
    let certificateManager: OPCUACertificateManager;
    before(async () => {
        certificateManager = new OPCUACertificateManager({});
    });
    after(() => {
        certificateManager.dispose();
    });

    let server_endpoint: OPCUAServerEndPoint;
    beforeEach(function () {
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

    it_with_crypto("should find a endpoint matching SignAndEncrypt / Basic256", function () {
        const endpoint_desc = server_endpoint.getEndpointDescription(
            MessageSecurityMode.SignAndEncrypt,
            SecurityPolicy.Basic256,
            null
        );
        should(endpoint_desc).be.instanceof(EndpointDescription);

        endpoint_desc!.userIdentityTokens!.length.should.eql(0);
    });
});

describe("OPCUAServerEndpoint#getEndpointDescription", function () {
    let certificateManager: OPCUACertificateManager;
    before(async () => {
        certificateManager = new OPCUACertificateManager({});
    });
    after(() => {
        certificateManager.dispose();
    });

    let server_endpoint: OPCUAServerEndPoint;
    beforeEach(function () {
        server_endpoint = new OPCUAServerEndPoint({
            port: port,
            serverInfo: new ApplicationDescription({}),
            certificateManager,
            certificateChain,
            privateKey: invalidPrivateKey
        });
    });



    it_with_crypto("should not find a endpoint matching MessageSecurityMode.SIGN and SecurityPolicy.Basic128", function () {

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

    it("should not find a endpoint matching MessageSecurityMode.Sign and SecurityPolicy.None", function () {
        const endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.Sign, SecurityPolicy.None, null);
        should(endpoint_desc).be.eql(null);
    });
    it("should not find a endpoint matching MessageSecurityMode.SignAndEncrypt and SecurityPolicy.None", function () {
        const endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.SignAndEncrypt, SecurityPolicy.None, null);
        should(endpoint_desc).be.eql(null);
    });
});
