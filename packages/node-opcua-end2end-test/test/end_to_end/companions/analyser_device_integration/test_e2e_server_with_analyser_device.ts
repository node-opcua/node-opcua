import "should";
import { BrowseDescription, BrowseDirection, type IAddressSpace, makeResultMask, nodesets, OPCUAClient } from "node-opcua";
import { makeRefId, UAProxyManager } from "node-opcua-client-proxy";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

import { build_server_with_temperature_device } from "../../../../test_helpers/build_server_with_temperature_device.js";

// Note: original JS test converted to TypeScript (async/await style, ES imports)

const port = 2240;
const doDebug = false; // set true for verbose structural dumps

// biome-ignore lint/suspicious/noExplicitAny: nodeset-instantiated companion-spec objects (ADI/DI) have dynamic child properties (e.g. .parameterSet, .isEnabled) with no static type
type DynamicNode = any;

function ns(namespaceIndex: number, browseName: string) {
    return `${namespaceIndex.toString()}:${browseName}`;
}

function create_analyser_device(addressSpace: IAddressSpace) {
    const adi_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");
    const di_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");

    const deviceType = addressSpace.findObjectType("DeviceType", di_namespace);
    void deviceType; // not directly used, retained for parity / potential debug

    const analyserDeviceType = addressSpace.findObjectType("AnalyserDeviceType", adi_namespace)!;

    const myAnalyserDeviceType = addressSpace.getOwnNamespace().addObjectType({
        browseName: "MyAnalyserDeviceType",
        subtypeOf: analyserDeviceType
    });

    const myAnalyser = myAnalyserDeviceType.instantiate({
        browseName: "MyAnalyser"
    });
    return myAnalyser;
}

interface DumpableComponent {
    browseName: { toString(): string };
    nodeId: { toString(): string };
    modellingRule: string | null | undefined;
}
interface DumpableObjectType {
    getComponents(): DumpableComponent[];
    subtypeOfObj: DumpableObjectType | null;
}
function dumpObjectType(objectType: DumpableObjectType) {
    function w(s: string | null | undefined, l: number) {
        return `${s}                       `.substring(0, l);
    }
    function f(c: DumpableComponent) {
        return `${w(c.browseName.toString(), 25)} ${w(c.nodeId.toString(), 25)}${w(c.modellingRule, 25)}`;
    }
    if (doDebug) {
        objectType.getComponents().forEach((c) => {
            console.log(f(c));
        });
    }
    let baseType = objectType.subtypeOfObj;
    if (doDebug) {
        baseType?.getComponents().forEach((c) => {
            console.log(f(c));
        });
    }
    baseType = baseType?.subtypeOfObj ?? null;
    if (doDebug) {
        baseType?.getComponents().forEach((c) => {
            console.log(f(c));
        });
    }
}

function _dumpStateMachine(stateMachineType: DynamicNode) {
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
        results.forEach((r: { toString(): string }) => {
            console.log(r.toString());
        });
    }
}

describe("ADI - Testing a server that exposes Analyser Devices", function (this: Mocha.Context) {
    let server: Awaited<ReturnType<typeof build_server_with_temperature_device>>;
    let client: OPCUAClient | null;
    let endpointUrl: string;
    let addressSpace: IAddressSpace;

    this.timeout(Math.max(50000, this.timeout()));

    const server_options = {
        port,
        nodeset_filename: [nodesets.standard, nodesets.di, nodesets.adi]
    };

    before(async () => {
        server = await build_server_with_temperature_device(server_options);
        endpointUrl = server.getEndpointUrl();
        addressSpace = server.engine.addressSpace!;
    });

    beforeEach(() => {
        client = OPCUAClient.create({ clientName: "test_e2e_server_with_analyser_device" });
    });

    afterEach(() => {
        client = null;
    });

    after(async () => {
        await server.shutdown();
        // biome-ignore lint/suspicious/noExplicitAny: release ref, bypassing the non-optional type
        (server as any) = null;
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
            subtypeOf: addressSpace.findObjectType("DeviceType")!
        });
        myDeviceType.instantiate({ browseName: "MyDevice" });
    });

    it("should instantiate a AnalyserChannelType", () => {
        const adi_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");
        const analyserChannelType = addressSpace.findObjectType("AnalyserChannelType", adi_namespace)!;
        analyserChannelType.browseName.toString().should.eql("3:AnalyserChannelType");

        const channel1 = analyserChannelType.instantiate({ browseName: "__Channel1", optionals: ["ParameterSet"] });
        (channel1 as DynamicNode).parameterSet.should.be.ok();

        if (doDebug) dumpObjectType(analyserChannelType);

        const channel2: DynamicNode = analyserChannelType.instantiate({ browseName: "__Channel2", optionals: ["ParameterSet"] });
        channel2.parameterSet.browseName.toString().should.eql("2:ParameterSet");
        channel2._clear_caches();

        if (doDebug) {
            console.log(channel2.toString());
            channel2.getComponents().forEach((c: DumpableComponent) => {
                console.log(c.browseName.toString());
            });
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
        const analyserDeviceType = addressSpace.findObjectType("AnalyserDeviceType", adi_namespace)!;
        analyserDeviceType.should.be.ok();
        analyserDeviceType.browseName.toString().should.eql("3:AnalyserDeviceType");
    });

    it("should have an AnalyserDeviceType v2", () => {
        const adi_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");
        const analyserDeviceType = addressSpace.findObjectType(ns(adi_namespace, "AnalyserDeviceType"))!;
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
        const analyserDeviceStateMachineType = addressSpace.findObjectType(ns(adi_namespace, "AnalyserDeviceStateMachineType"))!;
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
