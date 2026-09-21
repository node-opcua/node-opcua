import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { FindServersRequest, type FindServersResponse } from "node-opcua-service-discovery";
import { ApplicationDescription, ApplicationType } from "node-opcua-service-endpoints";
import should from "should";
import { OPCUABaseServer } from "../source/base_server.js";

// OPC 10000-4 v1.05.07 5.5.2.1: "A Server may have multiple HostNames. For this reason, the Client
// shall pass the URL it used to connect to the Endpoint to this Service. The implementation of this
// Service shall use this information to return responses that are accessible to the Client via the
// provided URL."
//
// A containerized server only knows its own (meaningless outside the container) host name, so the
// DiscoveryUrls it was configured with must be rewritten to the address the client actually used.

const containerHostUrl = "opc.tcp://f2754b6e40d3:48400";

function callFindServers(endpointUrl: string, discoveryUrls: string[] = [containerHostUrl]): Promise<FindServersResponse> {
    const baseServer = Object.create(OPCUABaseServer.prototype) as OPCUABaseServer;
    (baseServer as unknown as { getServers: () => ApplicationDescription[] }).getServers = () => [
        new ApplicationDescription({
            applicationName: { text: "Server", locale: "en" },
            applicationType: ApplicationType.Server,
            applicationUri: "urn:server",
            discoveryUrls,
            gatewayServerUri: "",
            productUri: "Server"
        })
    ];
    return new Promise<FindServersResponse>((resolve) => {
        const channel = {
            send_response: (_msgType: string, response: FindServersResponse) => resolve(response)
        };
        const message = { request: new FindServersRequest({ endpointUrl }) };
        (
            baseServer as unknown as {
                _on_FindServersRequest: (message: unknown, channel: unknown) => void;
            }
        )._on_FindServersRequest(message, channel);
    });
}

describe("FindServers - DiscoveryUrls must be reachable through the URL the client used", () => {
    it("should substitute the host name the client used in the returned DiscoveryUrls", async () => {
        const response = await callFindServers("opc.tcp://gds-server:48400");
        should(response.servers!.length).eql(1);
        should(response.servers![0].discoveryUrls).eql(["opc.tcp://gds-server:48400"]);
    });

    it("should keep the path of the DiscoveryUrl", async () => {
        const response = await callFindServers("opc.tcp://gds-server:48400", ["opc.tcp://f2754b6e40d3:48400/UA/Server"]);
        should(response.servers![0].discoveryUrls).eql(["opc.tcp://gds-server:48400/UA/Server"]);
    });

    it("should not touch DiscoveryUrls on a port the server does not serve", async () => {
        const response = await callFindServers("opc.tcp://gds-server:4840");
        should(response.servers![0].discoveryUrls).eql([containerHostUrl]);
    });

    it("should leave the DiscoveryUrls unchanged when no endpointUrl is given", async () => {
        const response = await callFindServers("");
        should(response.servers![0].discoveryUrls).eql([containerHostUrl]);
    });

    it("should leave the DiscoveryUrls unchanged when the endpointUrl cannot be parsed", async () => {
        const response = await callFindServers("not-an-url");
        should(response.servers![0].discoveryUrls).eql([containerHostUrl]);
    });

    it("should preserve every other field of the ApplicationDescription", async () => {
        const response = await callFindServers("opc.tcp://gds-server:48400");
        const server = response.servers![0];
        should(server.applicationUri).eql("urn:server");
        should(server.productUri).eql("Server");
        should(server.applicationType).eql(ApplicationType.Server);
        should(server.applicationName.text).eql("Server");
    });
});
