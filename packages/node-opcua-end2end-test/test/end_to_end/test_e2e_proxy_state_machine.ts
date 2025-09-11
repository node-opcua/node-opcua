// --------------------------------------------------------------------------------------------
//  Proxy State Machine Tests
//  These tests validate that UAProxyManager can introspect and represent
//  complex StateMachineType definitions coming from a custom fixture nodeset.
//  We exercise 2 representative finite state machines:
//     - ExclusiveLimitStateMachineType (standard limit-based transitions)
//     - ShelvedStateMachineType (alarm shelving model)
//  The test logs states & transitions to aid visual inspection and debugging.
// --------------------------------------------------------------------------------------------
import "should";
import { UAProxyManager } from "node-opcua-client-proxy";
import { getAddressSpaceFixture } from "node-opcua-address-space/testHelpers";
import { build_client_server_session, ClientServerSession } from "../../test_helpers/build_client_server_session";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

describe("testing client Proxy State Machine", function (this: Mocha.Context) {
    this.timeout(Math.max(200_000, this.timeout()));

    const port = 2245; // dedicated port for this test suite
    const serverOptions = {
        port,
        // Load a fixture that declares example state machine types & instances
        nodeset_filename: [getAddressSpaceFixture("fixture_simple_statemachine_nodeset2.xml")]
    };

    let session: any; // session type from build_client_server_session (ClientSession)
    let client_server: ClientServerSession;

    before(async () => {
        // Spin up server + client + session (helper guarantees a live session)
        client_server = await build_client_server_session(serverOptions as any);
        session = client_server.g_session; // active ClientSession used for all sub-tests
    });

    function dumpStats() {
        // Low-level perf counters from internal client (handy when diagnosing chatter)
        const client: any = (client_server as any).g_session._client;
        console.log("bytesRead              ", client.bytesRead, "bytes");
        console.log("transactionsPerformed  ", client.transactionsPerformed);
    }
    after(async () => {
        dumpStats();
        await client_server.shutdown();
    });

    /*
     @startuml exclusiveLimitStateMachineType

     9329: HighHigh
     9331: High
     9333: Low
     9335: LowLow
     9335 --> 9333 :   "9337\nLowLowToLow"
     9333 --> 9335 :   "9338\nLowToLowLow"
     9329 --> 9331 :   "9339\nHighHighToHigh"
     9331 --> 9329 :   "9340\nHighToHighHigh"

     @enduml
     */
    it("Z1a should read ExclusiveLimitStateMachineType definition & log it", async () => {
        dumpStats();
        const proxyManager = new UAProxyManager(session as any);
        await proxyManager.start();
        // Retrieve full proxy for the StateMachineType (not an instance) so we can
        // inspect its states & transitions metadata.
        const exclusiveLimitStateMachineType = "ExclusiveLimitStateMachineType";
        const obj = await proxyManager.getStateMachineType(exclusiveLimitStateMachineType);
        dumpStats();
        // initialState may be null if definition doesn't explicitly set a starting node
        console.log("InitialState = ", obj.initialState ? obj.initialState.toString() : "<null>");
        console.log(
            "States       = ",
            obj.states.map((state) => state.browseName.toString())
        );
        console.log(
            "Transitions  = ",
            obj.transitions.map((transition) => transition.browseName.toString())
        );
        await proxyManager.stop();
    });

    it("Z1b should read ShelvedStateMachineType definition & log it", async () => {
        const proxyManager = new UAProxyManager(session as any);
        await proxyManager.start();
        const ShelvedStateMachineType = "ShelvedStateMachineType";
        // Acquire the shelving state machine definition (used in alarm handling)
        const obj = await proxyManager.getStateMachineType(ShelvedStateMachineType);
        console.log("InitialState = ", obj.initialState ? obj.initialState.toString() : "<null>");
        console.log(
            "States       = ",
            obj.states.map((state) => state.browseName.toString())
        );
        console.log(
            "Transitions  = ",
            obj.transitions.map((transition) => transition.browseName.toString())
        );
        await proxyManager.stop();
    });
});
