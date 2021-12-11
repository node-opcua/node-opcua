"use strict";
const should = require("should");
const async = require("async");

const { OPCUAClient, makeResultMask, BrowseDescription, BrowseDirection, nodesets } = require("node-opcua");

const { UAProxyManager, makeRefId } = require("node-opcua-client-proxy");

const { dumpStateMachineToGraphViz, dumpStateMachineToPlantUML } = require("node-opcua-address-space/testHelpers");

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
                if (doDebug) {
                    dumpStateMachineToGraphViz(analyserDeviceStateMachineType);
                    dumpStateMachine(analyserDeviceStateMachineType);
                }

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

    it("ZZ1 should retrieve the AnalyserChannel_OperatingModeSubStateMachineType", function (done) {
        const adi_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");

        const subStateMachineType = addressSpace.findObjectType("AnalyserChannel_OperatingModeSubStateMachineType", adi_namespace);

        subStateMachineType.browseName.name.toString().should.eql("AnalyserChannel_OperatingModeSubStateMachineType");

        const sm = subStateMachineType.instantiate({ browseName: "MyStateMachine" });

        promoteToStateMachine(sm);

        redirectToFile("OperatingModeSubStateMachineType.graphviz", function () {
            dumpStateMachineToGraphViz(sm);
        });
        redirectToFile("OperatingModeSubStateMachineType.plantuml", function () {
            dumpStateMachineToPlantUML(sm);
        });

        done();
    });

    it("ZZ2 should retrieve the AnalyserChannel_OperatingModeExecuteSubStateMachineType", function (done) {
        const adi_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");

        const subStateMachineType = addressSpace.findObjectType(
            "AnalyserChannel_OperatingModeExecuteSubStateMachineType",
            adi_namespace
        );

        subStateMachineType.browseName.name.toString().should.eql("AnalyserChannel_OperatingModeExecuteSubStateMachineType");

        const StateMachine = require("node-opcua-address-space").StateMachine;

        const sm = subStateMachineType.instantiate({ browseName: "MyStateMachine" });

        promoteToStateMachine(sm);

        redirectToFile("OperatingModeExecuteSubStateMachineType.graphviz", function () {
            dumpStateMachineToGraphViz(sm);
        });
        redirectToFile("OperatingModeExecuteSubStateMachineType.plantuml", function () {
            dumpStateMachineToPlantUML(sm);
        });

        done();
    });
});

/*
 @startuml
 [*] --> 1286
 1286:Stopped
 1286: Stopped
 1288: Resetting
 1290: Idle
 1292: Starting
 1510: Completing
 1512: Complete
 1514: Suspending
 1516: Suspended
 1518: Unsuspending
 1520: Holding
 1522: Held
 1524: Unholding
 1526: Stopping
 1528: Aborting
 1530: Aborted
 1532: Clearing
 1286 --> 1288 : Stopped\nTo\nResetting\nTransition
 1288 --> 1288 : Resetting\nTransition
 1288 --> 1290 : Resetting\nTo\nIdle\nTransition
 1290 --> 1292 : Idle\nTo\nStarting\nTransition
 1292 --> 1292 : Starting\nTransition
 1292 --> 1294 : Starting\nTo\nExecute\nTransition
 1294 --> 1510 : Execute\nTo\nCompleting\nTransition
 1510 --> 1510 : Completing\nTransition
 1510 --> 1512 : Completing\nTo\nComplete\nTransition
 1512 --> 1286 : Complete\nTo\nStopped\nTransition
 1294 --> 1520 : Execute\nTo\nHolding\nTransition
 1520 --> 1520 : Holding\nTransition
 1520 --> 1522 : Holding\nTo\nHeld\nTransition
 1522 --> 1524 : Held\nTo\nUnholding\nTransition
 1524 --> 1524 : Unholding\nTransition
 1524 --> 1520 : Unholding\nTo\nHolding\nTransition
 1524 --> 1294 : Unholding\nTo\nExecute\nTransition
 1294 --> 1514 : Execute\nTo\nSuspending\nTransition
 1514 --> 1514 : Suspending\nTransition
 1514 --> 1516 : Suspending\nTo\nSuspended\nTransition
 1516 --> 1518 : Suspended\nTo\nUnsuspending\nTransition
 1518 --> 1518 : Unsuspending\nTransition
 1518 --> 1514 : Unsuspending\nTo\nSuspending\nTransition
 1518 --> 1294 : Unsuspending\nTo\nExecute\nTransition
 1526 --> 1286 : Stopping\nTo\nStopped\nTransition
 1528 --> 1530 : Aborting\nTo\nAborted\nTransition
 1530 --> 1532 : Aborted\nTo\nClearing\nTransition
 1532 --> 1286 : Clearing\nTo\nStopped\nTransition
 1288 --> 1526 : Resetting\nTo\nStopping\nTransition
 1290 --> 1526 : Idle\nTo\nStopping\nTransition
 1292 --> 1526 : Starting\nTo\nStopping\nTransition
 1294 --> 1526 : Execute\nTo\nStopping\nTransition
 1510 --> 1526 : Completing\nTo\nStopping\nTransition
 1512 --> 1526 : Complete\nTo\nStopping\nTransition
 1514 --> 1526 : Suspending\nTo\nStopping\nTransition
 1516 --> 1526 : Suspended\nTo\nStopping\nTransition
 1518 --> 1526 : Unsuspending\nTo\nStopping\nTransition
 1520 --> 1526 : Holding\nTo\nStopping\nTransition
 1522 --> 1526 : Held\nTo\nStopping\nTransition
 1524 --> 1526 : Unholding\nTo\nStopping\nTransition
 1286 --> 1528 : Stopped\nTo\nAborting\nTransition
 1288 --> 1528 : Resetting\nTo\nAborting\nTransition
 1290 --> 1528 : Idle\nTo\nAborting\nTransition
 1292 --> 1528 : Starting\nTo\nAborting\nTransition
 1294 --> 1528 : Execute\nTo\nAborting\nTransition
 1510 --> 1528 : Completing\nTo\nAborting\nTransition
 1512 --> 1528 : Complete\nTo\nAborting\nTransition
 1514 --> 1528 : Suspending\nTo\nAborting\nTransition
 1516 --> 1528 : Suspended\nTo\nAborting\nTransition
 1518 --> 1528 : Unsuspending\nTo\nAborting\nTransition
 1520 --> 1528 : Holding\nTo\nAborting\nTransition
 1522 --> 1528 : Held\nTo\nAborting\nTransition
 1524 --> 1528 : Unholding\nTo\nAborting\nTransition
 1526 --> 1528 : Stopping\nTo\nAborting\nTransition
 @enduml
 */

/*
 @startuml
 [*] --> 4031
 4031:SelectExecutionCycle
 4031: SelectExecutionCycle
 1664: WaitForCalibrationTrigger
 1666: ExtractCalibrationSample
 1668: PrepareCalibrationSample
 1670: AnalyseCalibrationSample
 1672: WaitForValidationTrigger
 1674: ExtractValidationSample
 1676: PrepareValidationSample
 1678: AnalyseValidationSample
 1680: WaitForSampleTrigger
 1682: ExtractSample
 1684: PrepareSample
 1686: AnalyseSample
 1688: WaitForDiagnosticTrigger
 1690: Diagnostic
 1692: WaitForCleaningTrigger
 1694: Cleaning
 1696: PublishResults
 1698: EjectGrabSample
 1700: CleanupSamplingSystem
 4031 --> 1664 : SelectExecutionCycle\nTo\nWaitForCalibrationTrigger\nTransition
 1664 --> 1666 : WaitForCalibrationTrigger\nTo\nExtractCalibrationSample\nTransition
 1666 --> 1666 : ExtractCalibrationSample\nTransition
 1666 --> 1668 : ExtractCalibrationSample\nTo\nPrepareCalibrationSample\nTransition
 1668 --> 1668 : PrepareCalibrationSample\nTransition
 1668 --> 1670 : PrepareCalibrationSample\nTo\nAnalyseCalibrationSample\nTransition
 1670 --> 1670 : AnalyseCalibrationSample\nTransition
 1670 --> 1696 : AnalyseCalibrationSample\nTo\nPublishResults\nTransition
 4031 --> 1672 : SelectExecutionCycle\nTo\nWaitForValidationTrigger\nTransition
 1672 --> 1674 : WaitForValidationTrigger\nTo\nExtractValidationSample\nTransition
 1674 --> 1674 : ExtractValidationSample\nTransition
 1674 --> 1676 : ExtractValidationSample\nTo\nPrepareValidationSample\nTransition
 1676 --> 1676 : PrepareValidationSample\nTransition
 1676 --> 1678 : PrepareValidationSample\nTo\nAnalyseValidationSample\nTransition
 1678 --> 1678 : AnalyseValidationSample\nTransition
 1678 --> 1696 : AnalyseValidationSample\nTo\nPublishResults\nTransition
 4031 --> 1680 : SelectExecutionCycle\nTo\nWaitForSampleTrigger\nTransition
 1680 --> 1682 : WaitForSampleTrigger\nTo\nExtractSample\nTransition
 1682 --> 1682 : ExtractSample\nTransition
 1682 --> 1684 : ExtractSample\nTo\nPrepareSample\nTransition
 1684 --> 1684 : PrepareSample\nTransition
 1684 --> 1686 : PrepareSample\nTo\nAnalyseSample\nTransition
 1686 --> 1686 : AnalyseSample\nTransition
 1686 --> 1696 : AnalyseSample\nTo\nPublishResults\nTransition
 4031 --> 1688 : SelectExecutionCycle\nTo\nWaitForDiagnosticTrigger\nTransition
 1688 --> 1690 : WaitForDiagnosticTrigger\nTo\nDiagnostic\nTransition
 1690 --> 1690 : Diagnostic\nTransition
 1690 --> 1696 : Diagnostic\nTo\nPublishResults\nTransition
 4031 --> 1692 : SelectExecutionCycle\nTo\nWaitForCleaningTrigger\nTransition
 1692 --> 1694 : WaitForCleaningTrigger\nTo\nCleaning\nTransition
 1694 --> 1694 : Cleaning\nTransition
 1694 --> 1696 : Cleaning\nTo\nPublishResults\nTransition
 1696 --> 1700 : PublishResults\nTo\nCleanupSamplingSystem\nTransition
 1696 --> 1698 : PublishResults\nTo\nEjectGrabSample\nTransition
 1698 --> 1698 : EjectGrabSample\nTransition
 1698 --> 1700 : EjectGrabSample\nTo\nCleanupSamplingSystem\nTransition
 1700 --> 1700 : CleanupSamplingSystem\nTransition
 1700 --> 4031 : CleanupSamplingSystem\nTo\nSelectExecutionCycle\nTransition
 @enduml
 */
