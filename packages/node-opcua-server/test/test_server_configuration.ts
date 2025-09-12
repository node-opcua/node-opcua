import { nodesets } from "node-opcua-nodesets";
import { UAVariable } from "node-opcua-address-space-base";
import should from "should";
import { ApplicationType } from "node-opcua-types";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { OPCUAServer, RegisterServerMethod } from "../source";

const port = 2022;

describe("OPCUAServer exposing serverConfiguration basic properties", () => {
    let server: OPCUAServer;

    const applicationType = ApplicationType.ClientAndServer;
    before(async () => {
        server = new OPCUAServer({
            port,
            nodeset_filename: [nodesets.standard],
            capabilitiesForMDNS: ["DA", "HAD", "LDS"],
            serverInfo: {
                applicationType,
                applicationName: { text: "SampleServer" },
                productUri: "SampleServer"
            },
            registerServerMethod: RegisterServerMethod.MDNS

        });
        await server.start();
        server.serverInfo.applicationType!.should.eql(ApplicationType.ClientAndServer);
    });
    after(async () => {
        await server.shutdown();
    });

    function getServerConfiguration() {
        const addressSpace = server.engine.addressSpace!;
        const serverConfiguration = addressSpace.rootFolder.objects.server.getComponentByName("ServerConfiguration")!;
        should.exist(serverConfiguration);
        return serverConfiguration;
    }
    it("should have a serverConfiguration.serverCapabilities uaVariable with the correct information", () => {
        const serverCapabilities = getServerConfiguration().getPropertyByName("ServerCapabilities") as UAVariable;
        should.exist(serverCapabilities);

        const serverCapabilitiesValue = serverCapabilities.readValue().value.value;

        // console.log(serverCapabilitiesValue.toString());

        serverCapabilitiesValue.should.eql(["DA", "HAD", "LDS"]);
    });
    it("should expose serverConfiguration.serverCapabilities.applicationType", () => {
        const applicationType = getServerConfiguration().getPropertyByName("ApplicationType") as UAVariable;
        should.exist(applicationType);

        const applicationTypeValue = applicationType.readValue().value.value;
        applicationTypeValue.should.eql(server.serverInfo.applicationType);
    });
    it("should expose serverConfiguration.serverCapabilities.productUri", () => {
        const productUri = getServerConfiguration().getPropertyByName("ProductUri") as UAVariable;
        should.exist(productUri);

        const productUriValue = productUri.readValue().value.value;
        productUriValue.should.eql("SampleServer");
    });

    it("should expose serverConfiguration.serverCapabilities.applicationUri", () => {
        const applicationUri = getServerConfiguration().getPropertyByName("ApplicationUri") as UAVariable;
        should.exist(applicationUri);

        const applicationUriValue = applicationUri.readValue().value.value;
        const expectedApplicationUri = server.serverInfo.applicationUri!;

        applicationUriValue.should.eql(expectedApplicationUri);
    });
    it("should expose serverConfiguration.serverCapabilities.multicastDnsEnabled", () => {
        const multicastDnsEnabled = getServerConfiguration().getPropertyByName("MulticastDnsEnabled") as UAVariable;
        should.exist(multicastDnsEnabled);

        const multicastDnsEnabledValue = multicastDnsEnabled.readValue().value.value;
        multicastDnsEnabledValue.should.eql(true);
    });
});
