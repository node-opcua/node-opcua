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

var makeRefId = require("lib/client/proxy").makeRefId;
function Namespace() {

}

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

        //xx console.log(deviceType.toString());
        var myDevice = deviceType.instantiate({
            browseName:"MyDevice"
        });
    });


    it("should instantiate a AnalyserChannelType",function() {

        var adi_namespace = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");

        var analyserChannelType  = addressSpace.findObjectType("AnalyserChannelType",adi_namespace);
        analyserChannelType.browseName.toString().should.eql("3:AnalyserChannelType");

        var channel1 = analyserChannelType.instantiate({
            browseName: "__Channel1"
        });

        should(channel1.parameterSet).eql(undefined);
        should(channel1.getComponentByName("ParameterSet")).eql(null,"optional ParameterSet shall not be instantiate ");

        var channel2 = analyserChannelType.instantiate({
            browseName: "__Channel2",
            optionals: [ "ParameterSet" ]
        });

        channel2.parameterSet.browseName.toString().should.eql("2:ParameterSet");
        channel2._clear_caches();
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

        should(analyserDeviceType).not.equal(undefined).and.not.eql(null);

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



});
