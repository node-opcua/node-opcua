import { type ClientSession, type ClientSessionRawSubscriptionService, OPCUAClient } from "node-opcua-client";
import { AttributeIds, BrowseDirection } from "node-opcua-data-model";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { OPCUAServer } from "../dist/index.js";

const port = 5841;
const diagnosticsNamespaceUri = "urn:test:diagnostics-namespace:runtime";

describe("diagnosticsNamespaceUri: the nodes the server creates while it runs, in a namespace of their own", function () {
    this.timeout(60000);
    let server: OPCUAServer;
    let client: OPCUAClient;

    before(async () => {
        server = new OPCUAServer({ port, nodeset_filename: [nodesets.standard], diagnosticsNamespaceUri });
        await server.initialize();
        await server.start();
        client = OPCUAClient.create({ endpointMustExist: false, connectionStrategy: { maxRetry: 0 } });
        await client.connect(server.getEndpointUrl());
    });
    after(async () => {
        await client.disconnect();
        await server.shutdown();
    });

    it("gives the Session its NodeId, its object and its diagnostics in that namespace", async () => {
        const session = (await client.createSession()) as ClientSession & ClientSessionRawSubscriptionService;
        const namespaces = (await session.read({ nodeId: "ns=0;i=2255", attributeId: AttributeIds.Value })).value.value as string[];
        const index = namespaces.indexOf(diagnosticsNamespaceUri);
        should(index > 1).eql(true, "registered after the server's own namespace");
        should(session.sessionId.namespace).eql(index);
        // the Session object under SessionsDiagnosticsSummary, and its SessionDiagnostics variable
        const children = await session.browse({
            nodeId: session.sessionId,
            browseDirection: BrowseDirection.Forward,
            referenceTypeId: "HasComponent",
            resultMask: 63
        });
        const diagnostics = (children.references ?? []).find((r) => r.browseName.name === "SessionDiagnostics");
        should(diagnostics?.nodeId.namespace).eql(index);
        // a Subscription's diagnostics, an element of the server's SubscriptionDiagnosticsArray
        const created = await session.createSubscription({
            requestedPublishingInterval: 100,
            requestedLifetimeCount: 600,
            requestedMaxKeepAliveCount: 10,
            maxNotificationsPerPublish: 0,
            publishingEnabled: true,
            priority: 0
        });
        const elements = await session.browse({
            nodeId: "ns=0;i=2290",
            browseDirection: BrowseDirection.Forward,
            referenceTypeId: "HasComponent",
            resultMask: 63
        });
        const element = (elements.references ?? []).find((r) => r.browseName.name === `${created.subscriptionId}`);
        should(element?.nodeId.namespace).eql(index);
        await session.close();
    });

    it("keeps them in the server's own namespace when not given", async () => {
        const plain = new OPCUAServer({ port: port + 1, nodeset_filename: [nodesets.standard] });
        await plain.initialize();
        await plain.start();
        const other = OPCUAClient.create({ endpointMustExist: false, connectionStrategy: { maxRetry: 0 } });
        await other.connect(plain.getEndpointUrl());
        const session = await other.createSession();
        should(session.sessionId.namespace).eql(1);
        await session.close();
        await other.disconnect();
        await plain.shutdown();
    });
});
