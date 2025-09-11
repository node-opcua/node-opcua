import "should";
import {
    OPCUAClient,
    makeResultMask,
    BrowseDescription,
    BrowseDirection,
    nodesets
} from "node-opcua";
import { UAProxyManager, makeRefId } from "node-opcua-client-proxy";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

import { build_server_with_temperature_device } from "../../../../test_helpers/build_server_with_temperature_device";

// Note: original JS test converted to TypeScript (async/await style, ES imports)

const port = 2240;
const doDebug = false; // set true for verbose structural dumps

function ns(namespaceIndex: number, browseName: string) {
    return namespaceIndex.toString() + ":" + browseName;
}

function create_analyser_device(addressSpace: any) {
    const adi_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");
    const di_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");

    const deviceType = addressSpace.findObjectType("DeviceType", di_namespace);
    void deviceType; // not directly used, retained for parity / potential debug

    const analyserDeviceType = addressSpace.findObjectType("AnalyserDeviceType", adi_namespace);

    const myAnalyserDeviceType = addressSpace.getOwnNamespace().addObjectType({
        browseName: "MyAnalyserDeviceType",
        subtypeOf: analyserDeviceType
    });

    const myAnalyser = myAnalyserDeviceType.instantiate({
        browseName: "MyAnalyser"
    });
    return myAnalyser;
}

function dumpObjectType(objectType: any) {
    function w(s: string, l: number) {
        return (s + "                       ").substring(0, l);
    }
    function f(c: any) {
        return w(c.browseName.toString(), 25) + " " + w(c.nodeId.toString(), 25) + w(c.modellingRule, 25);
    }
    if (doDebug) {
        objectType.getComponents().forEach((c: any) => console.log(f(c)));
    }
    let baseType = objectType.subtypeOfObj;
    if (doDebug) {
        baseType.getComponents().forEach((c: any) => console.log(f(c)));
    }
    baseType = baseType.subtypeOfObj;
    if (doDebug) {
        baseType.getComponents().forEach((c: any) => console.log(f(c)));
    }
}

function dumpStateMachine(stateMachineType: any) {
    const addressSpace = stateMachineType.addressSpace;
    (!!addressSpace).should.eql(true);
    const initialStateType = addressSpace.findObjectType("InitialStateType");
    (!!initialStateType).should.eql(true);
    const stateType = addressSpace.findObjectType("StateType");
    (!!stateType).should.eql(true);
    const transitionType = addressSpace.findObjectType("TransitionType");
    (!!transitionType).should.eql(true);

    const resultMask = makeResultMask("ReferenceType | IsForward | BrowseName | NodeClass | TypeDefinition");
    const bd = new BrowseDescription({
        nodeId: stateMachineType.nodeId,
        browseDirection: BrowseDirection.Forward,
        referenceTypeId: makeRefId("HasComponent"),
        resultMask
    });
    const results = stateMachineType.browseNode(bd);
    if (doDebug) {
        results.forEach((r: any) => console.log(r.toString()));
    }
}

describe("ADI - Testing a server that exposes Analyser Devices", function (this: Mocha.Context) {
    let server: any; // OPCUAServer
    let client: OPCUAClient | null;
    let endpointUrl: string;
    let addressSpace: any;

    this.timeout(Math.max(50000, this.timeout()));

    const server_options = {
        port,
        nodeset_filename: [nodesets.standard, nodesets.di, nodesets.adi]
    };

    before(async () => {
        server = await build_server_with_temperature_device(server_options as any);
        endpointUrl = server.getEndpointUrl();
        addressSpace = server.engine.addressSpace;
    });

    beforeEach(() => {
        client = OPCUAClient.create({ clientName: __filename });
    });

    afterEach(() => {
        client = null;
    });

    after(async () => {
        await server.shutdown();
        (server as any) = null; // release ref
    });

    it("should have a DeviceType in DI namespace", () => {
        const di_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
        di_namespace.should.eql(2);
        const deviceType = addressSpace.findObjectType("DeviceType", di_namespace);
        (!!deviceType).should.eql(true, "DeviceType must exist in DI namespace");
    });

    it("should instantiate a DeviceType", () => {
        const di_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
        const deviceType = addressSpace.findObjectType("DeviceType", di_namespace);
        void deviceType;
        const myDeviceType = addressSpace.getOwnNamespace().addObjectType({
            browseName: "MyDeviceType",
            subtypeOf: addressSpace.findObjectType("DeviceType")
        });
        myDeviceType.instantiate({ browseName: "MyDevice" });
    });

    it("should instantiate a AnalyserChannelType", () => {
        const adi_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");
        const analyserChannelType = addressSpace.findObjectType("AnalyserChannelType", adi_namespace);
        analyserChannelType.browseName.toString().should.eql("3:AnalyserChannelType");

        const channel1 = analyserChannelType.instantiate({ browseName: "__Channel1", optionals: ["ParameterSet"] });
        (channel1 as any).parameterSet.should.be.ok();

        if (doDebug) dumpObjectType(analyserChannelType);

        const channel2: any = analyserChannelType.instantiate({ browseName: "__Channel2", optionals: ["ParameterSet"] });
        channel2.parameterSet.browseName.toString().should.eql("2:ParameterSet");
        channel2._clear_caches();

        if (doDebug) {
            console.log(channel2.toString());
            channel2.getComponents().forEach((c: any) => console.log(c.browseName.toString()));
        }
        channel2.getComponentByName("ParameterSet").browseName.toString().should.eql("2:ParameterSet");

        // isEnabled Property variations
        const isEnabled1 = channel2.parameterSet.getComponentByName("IsEnabled");
        isEnabled1.browseName.toString().should.eql("3:IsEnabled");
        const isEnabled2 = channel2.parameterSet.isEnabled;
        isEnabled2.browseName.toString().should.eql("3:IsEnabled");

        // verify property also accessible in Configuration FunctionalGroup
        channel2.configuration.browseName.toString().should.eql("3:Configuration");
        channel2.configuration.findReferences("Organizes").length.should.be.aboveOrEqual(1);
        channel2.configuration.getFolderElementByName("IsEnabled").browseName.toString().should.eql("3:IsEnabled");
        channel2.configuration.isEnabled.browseName.toString().should.eql("3:IsEnabled");
    });

    it("should have an AnalyserDeviceType", () => {
        const adi_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");
        const di_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
        di_namespace.should.eql(2);
        adi_namespace.should.eql(3);
        const analyserDeviceType = addressSpace.findObjectType("AnalyserDeviceType", adi_namespace);
        analyserDeviceType.should.be.ok();
        analyserDeviceType.browseName.toString().should.eql("3:AnalyserDeviceType");
    });

    it("should have an AnalyserDeviceType v2", () => {
        const adi_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");
        const analyserDeviceType = addressSpace.findObjectType(ns(adi_namespace, "AnalyserDeviceType"));
        analyserDeviceType.browseName.toString().should.eql("3:AnalyserDeviceType");
    });

    it("should create a analyser device", () => {
        const analyser_device = create_analyser_device(addressSpace);
        analyser_device.should.be.ok();
    });

    it("should have an AnalyserDeviceStateMachineType", async () => {
        // PlantUML (retained from original for documentation)
        // @startuml
        // [*] --> 5022 (Powerup)
        // 5022 --> 5023 (PowerupToOperating)
        // 5023 <-> 5024 (Operating<->Local)
        // 5023 <-> 5025 (Operating<->Maintenance)
        // 5024 <-> 5025 (Local<->Maintenance)
        // 5023/5024/5025 --> 5026 (Shutdown)
        // 5026 --> [*]
        // @enduml
        const adi_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");
        const analyserDeviceStateMachineType = addressSpace.findObjectType(ns(adi_namespace, "AnalyserDeviceStateMachineType"));
        analyserDeviceStateMachineType.browseName.toString().should.eql("3:AnalyserDeviceStateMachineType");

        if (!client) throw new Error("client not created");
        await client.withSessionAsync(endpointUrl, async (session) => {
            const proxyManager = new UAProxyManager(session);
            await proxyManager.start();
            const stateMachineTypeId = analyserDeviceStateMachineType.nodeId;
            await proxyManager.getStateMachineType(stateMachineTypeId);
            await proxyManager.stop();
        });
    });
});
