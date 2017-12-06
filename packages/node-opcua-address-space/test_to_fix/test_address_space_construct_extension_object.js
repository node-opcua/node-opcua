// =====================================================================================================================
// the purpose of this test is to check the ability to create a extension object from it's node
// id out of the address_space
//
// For instance if ServerStatus
//    var ServerStatusDataType = addressSpace.findDataType("ServerStatus");
//    var serverStatus  = addressSpace.constructExtensionObject(ServerStatusDataType);
//    serverStatus.constructor.name.should.eql("ServerStatus");
//
//
"use strict";

var should = require("should");
var assert = require("node-opcua-assert");
var path = require("path");
var fs = require("fs");
var EUInformation = require("node-opcua-data-access").EUInformation;

var AddressSpace = require("..").AddressSpace;

// make sure all namespace 0 data type are properly loaded
var generate_address_space = require("..").generate_address_space;

var DataType = require("node-opcua-variant").DataType;
var Variant = require("node-opcua-variant").Variant;

var address_space = require("..");
var UADataType = address_space.UADataType;
var UAVariableType = address_space.UAVariableType;
var UAObject = address_space.UAObject;
var context = address_space.SessionContext.defaultContext;

function debugLog() {
}

var nodesets = require("node-opcua-nodesets");

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing address space namespace loading", function () {

    this.timeout(Math.max(300000, this._timeout));

    var addressSpace;
    before(function (done) {

        addressSpace = new AddressSpace();
        var xml_files = [
            nodesets.standard_nodeset_file,
            path.join(__dirname, "../../../", "modeling/my_data_type.xml")
        ];
        fs.existsSync(xml_files[0]).should.be.eql(true);
        fs.existsSync(xml_files[1]).should.be.eql(true);

        addressSpace.registerNamespace("ServerNamespaceURI");
        addressSpace.getNamespaceArray().length.should.eql(2);

        generate_address_space(addressSpace, xml_files, function (err) {
            done(err);
        });
    });
    after(function (done) {
        addressSpace.dispose();
        addressSpace = null;
        done();
    });

    it("should process namespaces and translate namespace index when loading node set xml files", function (done) {

        var serverStatusDataType = addressSpace.findDataType("ServerStatusDataType");
        serverStatusDataType.should.be.instanceOf(UADataType);

        serverStatusDataType.browseName.toString().should.eql("ServerStatusDataType");

        var serverStatus = addressSpace.constructExtensionObject(serverStatusDataType);
        serverStatus.constructor.name.should.eql("ServerStatus");

        serverStatus.should.have.property("startTime");
        serverStatus.should.have.property("currentTime");

        done();
    });

    it("should process namespaces and translate namespace index when loading node set xml files", function (done) {
        //
        // should  handle this case as well
        //
        //   - BaseDataType
        //       - Structure
        //           - FilterOperand
        //              - AttributeOperand
        //

        var attributeOperand = addressSpace.findDataType("AttributeOperand");
        attributeOperand.should.be.instanceOf(UADataType);

        attributeOperand.browseName.toString().should.eql("AttributeOperand");

        var op = addressSpace.constructExtensionObject(attributeOperand);
        op.constructor.name.should.eql("AttributeOperand");

        op.should.have.property("attributeId");
        op.should.have.property("browsePath");
        done();
    });

// and
//   - BaseDataType
//       - Structure
//          - UserIdentityToken
//            - AnonymousIdentityToken

    it("should create a arbitrary structure from a second name space", function (done) {


        var ns = addressSpace.getNamespaceIndex("http://yourorganisation.org/my_data_type/");
        ns.should.eql(2);

        var myStructureDataType = addressSpace.findDataType("MyStructureDataType", ns);
        myStructureDataType.should.be.instanceOf(UADataType);

        //------------------------------------------------------------------------------
        // create an extension object
        //------------------------------------------------------------------------------
        var op = addressSpace.constructExtensionObject(myStructureDataType);

        op.constructor.name.should.eql("MyStructure");

        op.should.have.property("lowValue");
        op.lowValue.should.eql(0);

        //xx debugLog("op.lowValue",op.lowValue.toString());

        //------------------------------------------------------------------------------
        // create a variable
        //------------------------------------------------------------------------------
        var myStructureType = addressSpace.findVariableType("MyStructureType", ns);
        myStructureType.should.be.instanceOf(UAVariableType);

        var folder = addressSpace.addFolder("ObjectsFolder", {browseName: "MyDevices"});
        assert(folder.nodeId);
        folder.should.be.instanceOf(UAObject);


        debugLog(" myStructureType = ", myStructureType.toString());

        var myVar = myStructureType.instantiate({
            browseName: "MyVar",
            organizedBy: folder
        });


        myVar.browseName.toString().should.eql("MyVar");

        myVar.readValue().value.value.should.be.instanceOf(op.constructor);

        // verify that variable property changes accordingly
        // now access UA Properties of the variable
        myVar.should.have.property("lowValue");

        // now change the underlying data
        myVar.readValue().value.value.lowValue = 10;

        myVar.lowValue.readValueAsync(context, function (err, dataValue) {
            dataValue.value.value.should.eql(10);
            done(err);
        });
    });

    it("should explore the DataType through OPCUA", function () {

        var ns = addressSpace.getNamespaceIndex("http://yourorganisation.org/my_data_type/");
        ns.should.eql(2);
        var myStructureDataType = addressSpace.findDataType("MyStructureDataType", ns);
        myStructureDataType.should.be.instanceOf(UADataType);

        debugLog(myStructureDataType.toString());

        // find the encoding
        //Xx debugLog(myStructureDataType.binaryEncoding.toString());

        debugLog(myStructureDataType.binaryEncodingDefinition.toString());
        debugLog("------------------------------------------------------------------------------")
        //xx debugLog(myStructureDataType.xmlEncoding.toString());
        debugLog(myStructureDataType.xmlEncodingDefinition.toString());

    });
    it("AB explore the DataType through OPCUA", function () {

        var ns = addressSpace.getNamespaceIndex("http://yourorganisation.org/my_data_type/");
        ns.should.eql(2);
        var myOtherStructureDataType = addressSpace.findDataType("MyOtherStructureDataType", ns);
        myOtherStructureDataType.should.be.instanceOf(UADataType);

        debugLog(myOtherStructureDataType.toString());

        // find the encoding
        //xx debugLog(myStructureDataType.binaryEncoding.toString());
        debugLog(myOtherStructureDataType.binaryEncodingDefinition.toString());
        debugLog("------------------------------------------------------------------------------")
        //xx debugLog(myStructureDataType.xmlEncoding.toString());
        debugLog(myOtherStructureDataType.xmlEncodingDefinition.toString());

    });


    it("should bind an xml-preloaded Extension Object Variable : ServerStatus ", function (done) {
        // in this test, we verify that we can easily bind the Server_ServerStatus object
        // the process shall automatically bind variables and substructures recursively
        var VariableIds = require("node-opcua-constants").VariableIds;
        var makeNodeId = require("node-opcua-nodeid").makeNodeId;

        var serverStatus = addressSpace.findNode(makeNodeId(VariableIds.Server_ServerStatus));
        serverStatus.browseName.toString().should.eql("ServerStatus");

        // before bindExtensionObject is called, startTime property exists but is not bound
        serverStatus.should.have.property("startTime");
        serverStatus.startTime.readValue().value.dataType.should.eql(DataType.Null);
        serverStatus.readValue().value.dataType.should.eql(DataType.Null);

        //Xx value.startTime.should.eql(DataType.Null);
        //xx debugLog("serverStatus.startTime =",serverStatus.startTime.readValue().value.toString());


        serverStatus.bindExtensionObject();

        serverStatus.readValue().value.value.startTime.toISOString().should.eql("1601-01-01T00:00:00.000Z");
        serverStatus.startTime.readValue().value.value.toISOString().should.eql("1601-01-01T00:00:00.000Z");

        serverStatus.readValue().value.value.startTime = new Date(Date.UTC(1800, 0, 1));
        serverStatus.readValue().value.value.startTime.toISOString().should.eql("1800-01-01T00:00:00.000Z");
        serverStatus.startTime.readValue().value.value.toISOString().should.eql("1800-01-01T00:00:00.000Z");


        serverStatus.startTime.setValueFromSource({dataType: DataType.DateTime, value: new Date(Date.UTC(2100, 0, 1))});
        serverStatus.readValue().value.value.startTime.toISOString().should.eql("2100-01-01T00:00:00.000Z");
        serverStatus.startTime.readValue().value.value.toISOString().should.eql("2100-01-01T00:00:00.000Z");
        //xx debugLog(serverStatus.readValue().value.toString());


        serverStatus.readValue().value.value.buildInfo.productName = "productName1";
        serverStatus.readValue().value.value.buildInfo.productName.should.eql("productName1");
        serverStatus.buildInfo.productName.readValue().value.value.should.eql("productName1");

        serverStatus.buildInfo.productName.setValueFromSource({dataType: DataType.String, value: "productName2"});
        serverStatus.readValue().value.value.buildInfo.productName.should.eql("productName2");
        serverStatus.buildInfo.productName.readValue().value.value.should.eql("productName2");

        var async = require("async");
        var StatusCodes = require("node-opcua-status-code").StatusCodes;
        var write_service = require("node-opcua-service-write");
        var WriteValue = write_service.WriteValue;
        var makeAccessLevel = require("node-opcua-data-model").makeAccessLevel;

        // now use WriteValue instead
        // make sure value is writable
        var rw = makeAccessLevel("CurrentRead | CurrentWrite");
        serverStatus.buildInfo.productName.accessLevel = rw;
        serverStatus.buildInfo.productName.userAccessLevel = rw;

        serverStatus.buildInfo.accessLevel = rw;
        serverStatus.buildInfo.userAccessLevel = rw;

        serverStatus.accessLevel = rw;
        serverStatus.userAccessLevel = rw;

        async.series([
            function (callback) {

                var writeValue = new WriteValue({
                    attributeId: 13, // value
                    value: {
                        statusCode: StatusCodes.Good,
                        value: {
                            dataType: DataType.String,
                            value: "productName3"
                        }
                    }
                });
                serverStatus.buildInfo.productName.writeAttribute(context, writeValue, function (err, statusCode) {
                    if (!err) {
                        statusCode.should.eql(StatusCodes.Good);
                    }
                    callback(err);
                });

            },
            function (callback) {
                serverStatus.buildInfo.productName.readValue().value.value.should.eql("productName3");
                serverStatus.readValue().value.value.buildInfo.productName.should.eql("productName3");
                callback();
            }
        ], done);
    });

    it("should instantiate SessionDiagnostics in a linear time", function () {

        var utils = require("node-opcua-utils");
        var sessionDiagnosticsDataType = addressSpace.findDataType("SessionDiagnosticsDataType");
        var sessionDiagnosticsVariableType = addressSpace.findVariableType("SessionDiagnosticsVariableType");


        var objs = [];

        function createDiagnostic(index) {
            var t5 = utils.get_clock_tick();
            var sessionObject = addressSpace.addObject({
                browseName: "Session" + index,
                organizedBy: addressSpace.rootFolder.objects
            });

            // the extension object
            var t6 = utils.get_clock_tick();
            var _sessionDiagnostics = addressSpace.constructExtensionObject(sessionDiagnosticsDataType);
            var t7 = utils.get_clock_tick();
            var sessionDiagnostics = sessionDiagnosticsVariableType.instantiate({
                browseName: "SessionDiagnostics",
                componentOf: sessionObject,
                value: new Variant({dataType: DataType.ExtensionObject, value: _sessionDiagnostics})
            });
            var t8 = utils.get_clock_tick();
            //xx debugLog(" t8-t7",t8-t7);

            objs.push(sessionObject);
        }

        for (var i = 0; i < 10; i++) {
            createDiagnostic(i);
        }
        objs.forEach(function (obj) {
            addressSpace.deleteNode(obj);
        });
    });

});

