"use strict";
const should = require("should");
const async = require("async");

const { OPCUAClient, makeResultMask, BrowseDescription, BrowseDirection, nodesets } = require("node-opcua");

const { UAProxyManager, makeRefId } = require("node-opcua-client-proxy");


const { redirectToFile } = require("node-opcua-debug/nodeJS");
const { promoteToStateMachine } = require("node-opcua-address-space");

const { build_server_with_temperature_device } = require("../../../../test_helpers/build_server_with_temperature_device");
const { perform_operation_on_client_session } = require("../../../../test_helpers/perform_operation_on_client_session");

const port = 2235;

const doDebug = false;

function ns(namespaceIndex, browseName) {
    return namespaceIndex.toString() + ":" + browseName;
}

function create_analyser_device(addressSpace) {
    const adi_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");
    const di_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");

    const deviceType = addressSpace.findObjectType("DeviceType", di_namespace);
    //xx console.log(deviceType.toString());

    const analyserDeviceType = addressSpace.findObjectType("AnalyserDeviceType", adi_namespace);
    //xx console.log(analyserDeviceType.toString());

    const myAnalyserDeviceType = addressSpace.getOwnNamespace().addObjectType({
        browseName: "MyAnalyserDeviceType",
        subtypeOf: analyserDeviceType
    });

    const myAnalyser = myAnalyserDeviceType.instantiate({
        browseName: "MyAnalyser"
    });
    return myAnalyser;
}

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("ADI - Testing a server that exposes Analyser Devices", function () {
    let server, client, endpointUrl;

    this.timeout(Math.max(50000, this.timeout()));

    const server_options = {
        port,
        nodeset_filename: [nodesets.standard, nodesets.di, nodesets.adi]
    };

    let analyser_device;

    let addressSpace;
    before(async () => {
        server = await build_server_with_temperature_device(server_options);
        endpointUrl = server.getEndpointUrl();

        addressSpace = server.engine.addressSpace;
    });

    beforeEach(() => {
        client = OPCUAClient.create({});
    });

    afterEach(() => {
        client = null;
    });

    after(async () => {
        await server.shutdown();
    });

    it("should have a DeviceType in DI namespace", function () {
        const di_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
        di_namespace.should.eql(2);

        const deviceType = addressSpace.findObjectType("DeviceType", di_namespace);
        (!!deviceType).should.eql(true, "DeviceType must exist in DI namespace");
    });

    it("should instantiate a DeviceType", function () {
        const di_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
        const deviceType = addressSpace.findObjectType("DeviceType", di_namespace);

        const myDeviceType = addressSpace.getOwnNamespace().addObjectType({
            browseName: "MyDeviceType",
            subtypeOf: addressSpace.findObjectType("DeviceType")
        });
        //xx console.log(deviceType.toString());
        const myDevice = myDeviceType.instantiate({
            browseName: "MyDevice"
        });
    });

    function dumpObjectType(objectType) {
        function w(s, l) {
            return (s + "                       ").substr(0, l);
        }

        function f(c) {
            return w(c.browseName.toString(), 25) + " " + w(c.nodeId.toString(), 25) + w(c.modellingRule, 25);
        }

        if (doDebug) {
            objectType.getComponents().forEach(function (c) {
                console.log(f(c));
            });
        }
        //xx console.log(chalk.yellow("zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz") + objectType.browseName.toString());
        let baseType = objectType.subtypeOfObj;

        if (doDebug) {
            baseType.getComponents().forEach(function (c) {
                console.log(f(c));
            });
        }
        //xx console.log(chalk.yellow("zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz") + baseType.browseName.toString());
        baseType = baseType.subtypeOfObj;
        if (doDebug) {
            baseType.getComponents().forEach(function (c) {
                console.log(f(c));
            });
        }
        //xx console.log(chalk.yellow("zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz") + baseType.browseName.toString());
    }

    it("should instantiate a AnalyserChannelType", function () {
        const adi_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");

        const analyserChannelType = addressSpace.findObjectType("AnalyserChannelType", adi_namespace);
        analyserChannelType.browseName.toString().should.eql("3:AnalyserChannelType");

        const channel1 = analyserChannelType.instantiate({
            browseName: "__Channel1",
            optionals: ["ParameterSet"]
        });

        should.exist(channel1.parameterSet, "Parameter set is mandatory since 1.1");

        if (doDebug) {
            dumpObjectType(analyserChannelType);
        }

        const channel2 = analyserChannelType.instantiate({
            browseName: "__Channel2",
            optionals: ["ParameterSet"]
        });

        channel2.parameterSet.browseName.toString().should.eql("2:ParameterSet");
        channel2._clear_caches();

        if (doDebug) {
            console.log(channel2.toString());
            channel2.getComponents().forEach(function (c) {
                console.log(c.browseName.toString());
            });
        }
        should.exist(channel2.getComponentByName("ParameterSet"));

        channel2.getComponentByName("ParameterSet").browseName.toString().should.eql("2:ParameterSet");

        // isEnable Property
        const isEnableParameter_variation1 = channel2.parameterSet.getComponentByName("IsEnabled");
        isEnableParameter_variation1.browseName.toString().should.eql("3:IsEnabled");

        const isEnableParameter_variation2 = channel2.parameterSet.isEnabled;
        isEnableParameter_variation2.browseName.toString().should.eql("3:IsEnabled");

        // verify that the isEnableParameter is also present in the "Configuration FunctionalGroup

        channel2.configuration.browseName.toString().should.eql("3:Configuration");

        channel2.configuration.findReferences("Organizes").length.should.be.aboveOrEqual(1);

        channel2.configuration.getFolderElementByName("IsEnabled").browseName.toString().should.eql("3:IsEnabled");
        channel2.configuration.isEnabled.browseName.toString().should.eql("3:IsEnabled");
    });

    it("should have an AnalyserDeviceType", function () {
        const adi_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");
        const di_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");

        di_namespace.should.eql(2);
        adi_namespace.should.eql(3);

        const analyserDeviceType = addressSpace.findObjectType("AnalyserDeviceType", adi_namespace);

        should.exist(analyserDeviceType);

        analyserDeviceType.browseName.toString().should.eql("3:AnalyserDeviceType");
    });

    it("should have an AnalyserDeviceType v2", function () {
        const adi_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");

        const analyserDeviceType = addressSpace.findObjectType(ns(adi_namespace, "AnalyserDeviceType"));

        analyserDeviceType.browseName.toString().should.eql("3:AnalyserDeviceType");
    });

    it("should create a analyser device", function () {
        analyser_device = create_analyser_device(server.engine.addressSpace);
    });

    function dumpStateMachine(stateMachineType) {
        const addressSpace = stateMachineType.addressSpace;
        should(!!addressSpace).eql(true);
        // enumerate states from components

        // InitialStateType

        // StateType

        // TransitionType

        const initialStateType = addressSpace.findObjectType("InitialStateType");
        should(!!initialStateType).eql(true);

        const stateType = addressSpace.findObjectType("StateType");
        should(!!stateType).eql(true);

        const transitionType = addressSpace.findObjectType("TransitionType");
        should(!!transitionType).eql(true);

        const browse_service = require("node-opcua-service-browse");

        const resultMask = makeResultMask("ReferenceType | IsForward | BrowseName | NodeClass | TypeDefinition");

        const bd = new BrowseDescription({
            nodeId: stateMachineType.nodeId,
            browseDirection: BrowseDirection.Forward,
            referenceTypeId: makeRefId("HasComponent"),
            resultMask: resultMask
        });
        const results = stateMachineType.browseNode(bd);
        if (doDebug) {
            results.forEach(function (result) {
                console.log(result.toString());
            });
        }
    }

    it("should have an AnalyserDeviceStateMachineType", function (done) {
        /**
         @startuml
         [*] --> 5022
         5022: Powerup
         5023: Operating
         5024: Local
         5025: Maintenance
         5026: Shutdown
         5022 --> 5023 : Powerup\nTo\nOperating\nTransition
         5023 --> 5024 : Operating\nTo\nLocal\nTransition
         5023 --> 5025 : Operating\nTo\nMaintenance\nTransition
         5024 --> 5023 : Local\nTo\nOperating\nTransition
         5024 --> 5025 : Local\nTo\nMaintenance\nTransition
         5025 --> 5023 : Maintenance\nTo\nOperating\nTransition
         5025 --> 5024 : Maintenance\nTo\nLocal\nTransition
         5023 --> 5026 : Operating\nTo\nShutdown\nTransition
         5024 --> 5026 : Local\nTo\nShutdown\nTransition
         5025 --> 5026 : Maintenance\nTo\nShutdown\nTransition
         5026 --> [*]
         @enduml
         */
        const adi_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");
        const analyserDeviceStateMachineType = addressSpace.findObjectType(ns(adi_namespace, "AnalyserDeviceStateMachineType"));

        analyserDeviceStateMachineType.browseName.toString().should.eql("3:AnalyserDeviceStateMachineType");

        perform_operation_on_client_session(
            client,
            endpointUrl,
            function (session, inner_done) {
                const proxyManager = new UAProxyManager(session);

                async.series(
                    [
                        function (callback) {
                            proxyManager.start(callback);
                        },
                        function (callback) {
                            const stateMachineTypeId = analyserDeviceStateMachineType.nodeId;
                            //"3:AnalyserDeviceStateMachineType";

                            proxyManager.getStateMachineType(stateMachineTypeId, function (err, obj) {
                                callback(err);
                            });
                        },
                        function (callback) {
                            proxyManager.stop(callback);
                        }
                    ],
                    inner_done
                );
            },
            done
        );
    });

});
