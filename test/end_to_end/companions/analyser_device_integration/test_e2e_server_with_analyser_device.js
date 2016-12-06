"use strict";

require("requirish")._(module);
var _ = require("underscore");
var should = require("should");
var assert = require("better-assert");
var path = require("path");
var opcua = require("index.js");
var async = require("async");
var StatusCodes = opcua.StatusCodes;
var Variant = opcua.Variant;
var DataType = opcua.DataType;
var DataValue = opcua.DataValue;

var UAProxyManager = require("lib/client/proxy").UAProxyManager;
require("lib/client/state_machine_proxy");

var dumpStateMachineToGraphViz = require("lib/misc/dump_statemachine").dumpStateMachineToGraphViz;
var dumpStateMachineToPlantUML = require("lib/misc/dump_statemachine").dumpStateMachineToPlantUML;


var makeRefId = require("lib/client/proxy").makeRefId;

function ns(namespaceIndex,browseName) {
    return namespaceIndex.toString() + ":" + browseName;
}

function create_analyser_device(addressSpace) {

    var adi_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");
    var di_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");

    var deviceType = addressSpace.findObjectType("DeviceType",di_namespace);
    //xx console.log(deviceType.toString());

    var analyserDeviceType = addressSpace.findObjectType("AnalyserDeviceType",adi_namespace);
    //xx console.log(analyserDeviceType.toString());

    var myAnalyserDeviceType = addressSpace.addObjectType({
        browseName: "MyAnalyserDeviceType",
        subtypeOf: analyserDeviceType
    });


    var myAnalyser = myAnalyserDeviceType.instantiate({
       browseName: "MyAnalyser"
    });
    return myAnalyser;

}


var build_server_with_temperature_device = require("test/helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;

var standard_nodeset_file = opcua.standard_nodeset_file;

describe("ADI - Testing a server that exposes Analyser Devices",function(){

    var server, client, endpointUrl;

    this.timeout(Math.max(50000,this._timeout));

    var server_options = {
        port: 2000,
        nodeset_filename: [
            standard_nodeset_file,
            path.join(__dirname,"../../../../nodesets/Opc.Ua.Di.NodeSet2.xml"),
            path.join(__dirname,"../../../../nodesets/Opc.Ua.Adi.NodeSet2.xml")
        ]
    };

    var analyser_device;
    var port = 2000;

    var addressSpace;
    before(function (done) {
        port += 1;
        server = build_server_with_temperature_device(server_options, function (err) {
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;

            addressSpace = server.engine.addressSpace;

            done(err);
        });
    });

    beforeEach(function (done) {
        client = new opcua.OPCUAClient();
        done();
    });

    afterEach(function (done) {
        client = null;
        done();
    });

    after(function (done) {
        server.shutdown(done);
    });

    it("should have a DeviceType in DI namespace",function() {

        var di_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
        di_namespace.should.eql(2);

        var deviceType = addressSpace.findObjectType("DeviceType",di_namespace);
        (!!deviceType).should.eql(true,"DeviceType must exist in DI namespace");
    });

    it("should instantiate a DeviceType",function() {

        var di_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
        var deviceType = addressSpace.findObjectType("DeviceType",di_namespace);

        var myDeviceType = addressSpace.addObjectType({
            browseName: "MyDeviceType",
            subtypeOf: addressSpace.findObjectType("DeviceType")
        })
        //xx console.log(deviceType.toString());
        var myDevice = myDeviceType.instantiate({
            browseName:"MyDevice"
        });
    });


    function dumpObjectType(objectType) {

        function w(s,l) { return (s + "                       ").substr(0,l);}
        function f(c) {
            return  w(c.browseName.toString(),25) + " " + w(c.nodeId.toString(),25) + w(c.modellingRule,25);
        }
        objectType.getComponents().forEach(function(c){console.log(f(c));});
        console.log("zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz".yellow + objectType.browseName.toString());
        var baseType = objectType.subtypeOfObj;
        baseType.getComponents().forEach(function(c){console.log(f(c));});
        console.log("zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz".yellow+ baseType.browseName.toString());
        baseType = baseType.subtypeOfObj;
        baseType.getComponents().forEach(function(c){console.log(f(c));});
        console.log("zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz".yellow+ baseType.browseName.toString());

    }

    it("should instantiate a AnalyserChannelType",function() {

        var adi_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");

        var analyserChannelType  = addressSpace.findObjectType("AnalyserChannelType",adi_namespace);
        analyserChannelType.browseName.toString().should.eql("3:AnalyserChannelType");

        var channel1 = analyserChannelType.instantiate({
            browseName: "__Channel1"
        });

        should.not.exist(channel1.parameterSet);
        should.not.exist(channel1.getComponentByName("ParameterSet"),"optional ParameterSet shall not be instantiate ");

        dumpObjectType(analyserChannelType);

        var channel2 = analyserChannelType.instantiate({
            browseName: "__Channel2",
            optionals: [ "ParameterSet" ]
        });

        channel2.parameterSet.browseName.toString().should.eql("2:ParameterSet");
        channel2._clear_caches();

        console.log(channel2.toString());
        channel2.getComponents().forEach(function(c){console.log(c.browseName.toString())});

        should.exist(channel2.getComponentByName("2:ParameterSet"));

        channel2.getComponentByName("2:ParameterSet").browseName.toString().should.eql("2:ParameterSet");

        // isEnable Property
        var isEnableParameter_variation1 = channel2.parameterSet.getComponentByName("3:IsEnabled");
        isEnableParameter_variation1.browseName.toString().should.eql("3:IsEnabled");


        var isEnableParameter_variation2 = channel2.parameterSet.isEnabled;
        isEnableParameter_variation2.browseName.toString().should.eql("3:IsEnabled");

        // verify that the isEnableParameter is also present in the "Configuration FunctionalGroup

        channel2.configuration.browseName.toString().should.eql("3:Configuration");


        channel2.configuration.findReferences("Organizes").length.should.be.aboveOrEqual(1);

        channel2.configuration.getFolderElementByName("3:IsEnabled").browseName.toString().should.eql("3:IsEnabled");
        channel2.configuration.isEnabled.browseName.toString().should.eql("3:IsEnabled");

    });


    it("should have a AnalyserDeviceType",function() {


        var adi_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");
        var di_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");

        //xxx console.log(addressSpace.getNamespaceArray());
        di_namespace.should.eql(2);
        adi_namespace.should.eql(3);

        var analyserDeviceType = addressSpace.findObjectType("AnalyserDeviceType",adi_namespace);

        should.exist(analyserDeviceType);

        analyserDeviceType.browseName.toString().should.eql("3:AnalyserDeviceType");
    });


    it("should have a AnalyserDeviceType v2",function() {

        var adi_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");

        var analyserDeviceType = addressSpace.findObjectType(ns(adi_namespace,"AnalyserDeviceType"));

        analyserDeviceType.browseName.toString().should.eql("3:AnalyserDeviceType");

    });

    it("should create a analyser device",function() {
        analyser_device = create_analyser_device(server.engine.addressSpace);

    });



    function dumpStateMachine(stateMachineType) {

        var addressSpace = stateMachineType.__address_space;
        should(!!addressSpace).eql(true);
        // enumerate states from components

        // InitialStateType

        // StateType

        // TransitionType

        var initialStateType = addressSpace.findObjectType("InitialStateType");
        should(!!initialStateType).eql(true);

        var stateType = addressSpace.findObjectType("StateType");
        should(!!stateType).eql(true);

        var transitionType = addressSpace.findObjectType("TransitionType");
        should(!!transitionType).eql(true);

        var browse_service   = require("lib/services/browse_service");

        var resultMask = browse_service.makeResultMask("ReferenceType | IsForward | BrowseName | NodeClass | TypeDefinition");

        var bd = new opcua.browse_service.BrowseDescription({
            nodeId: stateMachineType.nodeId,
            browseDirection: opcua.browse_service.BrowseDirection.Forward,
            referenceTypeId: makeRefId("HasComponent"),
            resultMask: resultMask

        });
        var results = stateMachineType.browseNode(bd);
        results.forEach(function(result){ console.log(result.toString());});
    }

    it("should have a AnalyserDeviceStateMachineType",function(done) {

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
        var adi_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");
        var analyserDeviceStateMachineType = addressSpace.findObjectType(ns(adi_namespace,"AnalyserDeviceStateMachineType"));

        analyserDeviceStateMachineType.browseName.toString().should.eql("3:AnalyserDeviceStateMachineType");


        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {


            //xx dumpStateMachineToGraphViz(analyserDeviceStateMachineType);
            //xxdumpStateMachine(analyserDeviceStateMachineType);

            var proxyManager = new UAProxyManager(session);

            async.series([
                function (callback) {
                    proxyManager.start(callback);
                },
                function (callback) {
                    var stateMachineTypeId = analyserDeviceStateMachineType.nodeId;
                    //"3:AnalyserDeviceStateMachineType";

                    proxyManager.getStateMachineType(stateMachineTypeId, function (err, obj) {

                        callback(err);
                    });
                },
                function (callback) {
                    proxyManager.stop(callback);
                }
            ], inner_done);
        },done);
    });


    it("ZZ1 should retrieve the AnalyserChannel_OperatingModeSubStateMachineType",function(done) {


        var adi_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");

        var subStateMachineType = addressSpace.findObjectType("AnalyserChannel_OperatingModeSubStateMachineType",adi_namespace);

        subStateMachineType.browseName.name.toString().should.eql("AnalyserChannel_OperatingModeSubStateMachineType");

        var UAStateMachine = require("lib/address_space/finite_state_machine").UAStateMachine;

        var sm = subStateMachineType.instantiate({ browseName: "MyStateMachine"});

        UAStateMachine.promote(sm);

        dumpStateMachineToGraphViz(sm);

        dumpStateMachineToPlantUML(sm);


        done();
    });

    it("ZZ2 should retrieve the AnalyserChannel_OperatingModeExecuteSubStateMachineType",function(done) {



        var adi_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");

        var subStateMachineType = addressSpace.findObjectType("AnalyserChannel_OperatingModeExecuteSubStateMachineType",adi_namespace);

        subStateMachineType.browseName.name.toString().should.eql("AnalyserChannel_OperatingModeExecuteSubStateMachineType");

        var UAStateMachine = require("lib/address_space/finite_state_machine").UAStateMachine;

        var sm = subStateMachineType.instantiate({ browseName: "MyStateMachine"});

        UAStateMachine.promote(sm);

        dumpStateMachineToGraphViz(sm);

        dumpStateMachineToPlantUML(sm);


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