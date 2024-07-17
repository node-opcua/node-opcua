import "should";
import { nodesets } from "node-opcua-nodesets";
import { SecurityPolicy } from "node-opcua-secure-channel";
import { getFullyQualifiedDomainName } from "node-opcua-hostname";
import { OPCUAServer } from "../source";
import { createServerCertificateManager } from "./create_server_certificate_manager";

const port = 2011;

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("OPCUAServerEndpoint#addEndpointDescription multiple hostname", () => {
    it("should be possible to create endpoints on multiple host names", async () => {
        const serverCertificateManager = await createServerCertificateManager(port);

        // Given a server with two host names
        const server = new OPCUAServer({
            port,
            serverCertificateManager,
            nodeset_filename: [nodesets.standard],
            alternateHostname: ["1.2.3.4", "MyName"],
            securityPolicies: [
                SecurityPolicy.None,
                SecurityPolicy.Basic256Sha256,
                SecurityPolicy.Basic256,
                SecurityPolicy.Basic128Rsa15,
                SecurityPolicy.Aes256_Sha256_RsaPss
                //  SecurityPolicy.Aes128_Sha256_RsaOaep
            ]
        });

        await server.start();

        // When we count the exposed endpoint
        let matching1234Count = 0;
        let matchingMyName = 0;

        for (const e of server.endpoints) {
            for (const ed of e.endpointDescriptions()) {
                if (ed.endpointUrl!.match(/1\.2\.3\.4/)) {
                    matching1234Count++;
                }
                if (ed.endpointUrl!.match(/MyName/)) {
                    matchingMyName++;
                }
            }
        }

        matching1234Count.should.eql(9, "we should have 9 endpoints matches the IP address");
        matchingMyName.should.eql(9, "we should have 9 endpoints matches the Hostname");

        await server.shutdown();

        server.dispose();
    });
});
describe("OPCUAServerEndpoint#addEndpointDescription default hostname", () => {
    it("should default to using the machine hostname as the hostname", async () => {
        // Given a server with no explicit hostname

        const serverCertificateManager = await createServerCertificateManager(port);
        const server = new OPCUAServer({
            port,
            serverCertificateManager,
            nodeset_filename: [nodesets.standard],
            securityPolicies: [
                SecurityPolicy.None,
                SecurityPolicy.Basic256Sha256,
                SecurityPolicy.Basic256,
                // SecurityPolicy.Basic128Rsa15,
                // SecurityPolicy.Aes256_Sha256_RsaPss
                // SecurityPolicy.Aes128_Sha256_RsaOaep
            ]
        });

        await server.start();

        const defaultHostname = getFullyQualifiedDomainName();
        const defaultHostnameRegex = RegExp(defaultHostname);

        // When we count the exposed endpoint
        let matchingDefault = 0;

        for (const e of server.endpoints) {
            for (const ed of e.endpointDescriptions()) {
                if (ed.endpointUrl!.match(defaultHostnameRegex)) {
                    matchingDefault++;
                }
            }
        }

        matchingDefault.should.eql(5, "we should have 5 endpoints matching the machine hostname");

        await server.shutdown();

        server.dispose();
    });
});

describe("OPCUAServerEndpoint#addEndpointDescription custom hostname", () => {
    it("should be possible to create endpoints on multiple host names", async () => {
        const myHostname = "my.test.website";

        const serverCertificateManager = await createServerCertificateManager(port);

        // Given a server with two host names
        const server = new OPCUAServer({
            hostname: myHostname,
            port,

            serverCertificateManager,
            nodeset_filename: [nodesets.standard]
        });

        await server.start();

        // When we count the exposed endpoint
        let matchingHostname = 0;

        for (const e of server.endpoints) {
            for (const ed of e.endpointDescriptions()) {
                if (ed.endpointUrl!.match(/my.test.website/)) {
                    matchingHostname++;
                }
            }
        }

        matchingHostname.should.eql(7, "we should have 7 endpoints matches the custom hostname");

        await server.shutdown();

        server.dispose();
    });
});
