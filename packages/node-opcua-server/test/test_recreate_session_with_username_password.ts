import sinon from "sinon";
import "should";

import {
    OPCUAServer,
} from "..";

import {
    MessageSecurityMode,
    OPCUAClient,
    SecurityPolicy,
    ClientSession,
    UserTokenType,
} from "node-opcua-client";
const seconds = 1000;
const port = 48444;
import { describeWithLeakDetector as describe} from "node-opcua-leak-detector";

async function startClient() {

    //const endpointUri = "opc.tcp://opcua.umati.app:4843";
    const endpointUri = `opc.tcp://localhost:${port}`;



    const client = OPCUAClient.create({
        endpointMustExist: false,
        securityMode: MessageSecurityMode.SignAndEncrypt,
        securityPolicy: SecurityPolicy.Basic256Sha256,
        requestedSessionTimeout: 3 * seconds,
        transportTimeout: 2 * seconds,

    });
    client.on("backoff", (retry, delay) => {
        console.log("Retrying in ", delay / 1000.0, " seconds");
    });

    console.log("connecting to", endpointUri);

    await client.connect(endpointUri);

    const session = await client.createSession({
        type: UserTokenType.UserName,
        userName: "admin",
        password: "pw1",
    });
    console.log("session created ");

    await session.read({ nodeId: "ns=0;i=2258", attributeId: 13 });

    console.log("requested sessionTimeout           ", (client as any).requestedSessionTimeout);
    console.log("sessionTimeout                     ", session.timeout);
    console.log("tokenRenewalInterval               ", client.tokenRenewalInterval);
    console.log("requested socket timeout           ", (client as any)._transportTimeout); // not public api !
    console.log("socket timeout                     ", (client as any)._secureChannel.getTransport()._socket.timeout);
    //console.log("_secureChannel?.timeout", client._secureChannel);  
    console.log("activeSecurityToken.revisedLifetime", (client as any)._secureChannel.activeSecurityToken.revisedLifetime);
    console.log("connected ");


    return { client, session };
}

async function stopClient({ client, session }: { client: OPCUAClient, session: ClientSession }) {
    // wait until the user press Control-C
    // in the meantime, the session will live up to sessionSimeout and will expire
    // causing the client to reconnect to the server
    // however the server will not close the pending sessions and will 
    // get to a point where the number of session will be saturated,
    // cause the crash

    await session.close();
    console.log("session closed ");
    await client.disconnect();
    console.log("disconnected");

}

async function startServer() {
    const server = new OPCUAServer({
        port,

        allowAnonymous: false,
        securityModes: [MessageSecurityMode.SignAndEncrypt],
        securityPolicies: [SecurityPolicy.Basic256, SecurityPolicy.Basic256Sha256],
        userManager: {
            isValidUser:  (userName: string, password: string) => {
                return userName === "admin" && password === "pw1";
            },
        },
        serverCapabilities: {
            maxSessions: 2,
        },
        maxConnectionsPerEndpoint: 2,
    });

    await server.initialize();
    await server.start();

    console.log("server started at ", server.getEndpointUrl());
    return server;
}
async function stopServer(server: OPCUAServer) {
    // await new Promise((resolve) => process.on("SIGINT", resolve));

    await server.shutdown();
    console.log("server shutdown");
}


describe("testing that servers supports reconnection with ActivateSession when UserName/Password session are created", function () {

    it("it should automaticall allow client to reactivate the session by using same credientials", async () => {
    
    
        const connectionLostSpy = sinon.spy();
        const reconnectionAttemptHasFailedSpy = sinon.spy();
        const afterReconnectionSpy = sinon.spy();   

        const server = await startServer(); 
        const { client, session } = await startClient();
        client.on("connection_lost", connectionLostSpy);
        client.on("reconnection_attempt_has_failed", reconnectionAttemptHasFailedSpy);
        client.on("after_reconnection", afterReconnectionSpy);
        
        await new Promise<void>((resolve) => setTimeout(resolve, 10 * seconds));


        await stopClient({ client, session });
        await stopServer(server);


        connectionLostSpy.callCount.should.be.greaterThan(2, "at least one connection lost should have been detected");
        reconnectionAttemptHasFailedSpy.callCount.should.eql(0, "all reconnection attempts should have succeeded");
        afterReconnectionSpy.callCount.should.be.greaterThan(1, "at least one reconnection should have been detected");

    });

});
