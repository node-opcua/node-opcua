// =====================================================================================================================
// the purpose of this test is to check the ability to create a extension object from it's node
// id out of the address_space
//
// For instance if ServerStatus
//    const ServerStatusDataType = addressSpace.findDataType("ServerStatus");
//    const serverStatus  = addressSpace.constructExtensionObject(ServerStatusDataType);
//    serverStatus.constructor.name.should.eql("ServerStatus");
//
//
"use strict";

const should = require("should");
const assert = require("node-opcua-assert").assert;
const path = require("path");
const fs = require("fs");
const EUInformation = require("node-opcua-data-access").EUInformation;

const AddressSpace = require("../index").AddressSpace;

// make sure all namespace 0 data type are properly loaded
const generate_address_space = require("../index").generate_address_space;

const DataType = require("node-opcua-variant").DataType;
const Variant = require("node-opcua-variant").Variant;

const address_space = require("../index");
const UADataType = address_space.UADataType;
const UAVariableType = address_space.UAVariableType;
const UAObject = address_space.UAObject;
const context = address_space.SessionContext.defaultContext;

function debugLog() {}

const nodesets = require("node-opcua-nodesets");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing address space namespace loading", function() {
    this.timeout(Math.max(300000, this._timeout));

    let addressSpace;
    before(function(done) {
        addressSpace = new AddressSpace();
        const xml_files = [
            nodesets.standard_nodeset_file,
            path.join(__dirname, "../../../", "modeling/my_data_type.xml")
        ];
        fs.existsSync(xml_files[0]).should.be.eql(true);
        fs.existsSync(xml_files[1]).should.be.eql(true);

        addressSpace.registerNamespace("ServerNamespaceURI");
        addressSpace.getNamespaceArray().length.should.eql(2);

        generate_address_space(addressSpace, xml_files, function(err) {
            done(err);
        });
    });
    after(function(done) {
        addressSpace.dispose();
        addressSpace = null;
        done();
    });

    it("should be possible to create a ServerStatus ExtensionObject ", function(done) {
        const serverStatusDataType = addressSpace.findDataType("ServerStatusDataType");
        serverStatusDataType.should.be.instanceOf(UADataType);

        serverStatusDataType.browseName.toString().should.eql("ServerStatusDataType");
        const serverStatus = addressSpace.constructExtensionObject(serverStatusDataType);
        serverStatus.constructor.name.should.eql("ServerStatus");
        serverStatus.should.have.property("startTime");
        serverStatus.should.have.property("currentTime");

        done();
    });

    it("should be possible to create an AttributeOperand ExtensionObject", function(done) {
        //
        // should  handle this case as well
        //
        //   - BaseDataType
        //       - Structure
        //           - FilterOperand
        //              - AttributeOperand
        //

        const attributeOperand = addressSpace.findDataType("AttributeOperand");
        attributeOperand.should.be.instanceOf(UADataType);

        attributeOperand.browseName.toString().should.eql("AttributeOperand");

        const op = addressSpace.constructExtensionObject(attributeOperand);
        op.constructor.name.should.eql("AttributeOperand");

        op.should.have.property("attributeId");
        op.should.have.property("browsePath");
        done();
    });

    it("should create a arbitrary structure from a second name space", function(done) {
        const ns = addressSpace.getNamespaceIndex("http://yourorganisation.org/my_data_type/");
        ns.should.eql(2);

        const myStructureDataType = addressSpace.findDataType("MyStructureDataType", ns);
        myStructureDataType.should.be.instanceOf(UADataType);

        //------------------------------------------------------------------------------
        // create an extension object
        //------------------------------------------------------------------------------
        const op = addressSpace.constructExtensionObject(myStructureDataType);

        op.constructor.name.should.eql("MyStructure");

        op.should.have.property("lowValue");
        op.lowValue.should.eql(0);

        //xx debugLog("op.lowValue",op.lowValue.toString());

        //------------------------------------------------------------------------------
        // create a variable
        //------------------------------------------------------------------------------
        const myStructureType = addressSpace.findVariableType("MyStructureType", ns);
        myStructureType.should.be.instanceOf(UAVariableType);

        const folder = addressSpace.addFolder("ObjectsFolder", { browseName: "MyDevices" });
        assert(folder.nodeId);
        folder.should.be.instanceOf(UAObject);

        debugLog(" myStructureType = ", myStructureType.toString());

        const myVar = myStructureType.instantiate({
            browseName: "MyVar",
            organizedBy: folder
        });
        myVar.browseName.toString().should.eql("MyVar");

        myVar.$extensionObject.should.be.instanceOf(op.constructor);

        myVar.readValue().value.value.should.be.instanceOf(op.constructor);

        // verify that variable property changes accordingly
        // now access UA Properties of the variable
        myVar.should.have.property("lowValue");

        // now change the underlying data

        myVar.$extensionObject.lowValue = 10;

        // verify that value has changed using all way to access it
        myVar.lowValue.readValue().value.value.should.eql(10);
        myVar.readValue().value.value.lowValue.should.eql(10);

        done();
    });

    it("should explore the DataType through OPCUA", function() {
        const ns = addressSpace.getNamespaceIndex("http://yourorganisation.org/my_data_type/");
        ns.should.eql(2);
        const myStructureDataType = addressSpace.findDataType("MyStructureDataType", ns);
        myStructureDataType.should.be.instanceOf(UADataType);

        debugLog(myStructureDataType.toString());

        // find the encoding
        //Xx debugLog(myStructureDataType.binaryEncoding.toString());

        debugLog(myStructureDataType.binaryEncodingDefinition.toString());
        debugLog("------------------------------------------------------------------------------");
        //xx debugLog(myStructureDataType.xmlEncoding.toString());
        debugLog(myStructureDataType.xmlEncodingDefinition.toString());
    });

    it("AC explore the DataType through OPCUA", function() {
        const ns = addressSpace.getNamespaceIndex("http://yourorganisation.org/my_data_type/");
        ns.should.eql(2);
        const myOtherStructureDataType = addressSpace.findDataType("MyOtherStructureDataType", ns);
        myOtherStructureDataType.should.be.instanceOf(UADataType);

        debugLog(myOtherStructureDataType.toString());

        // find the encoding
        //xx debugLog(myStructureDataType.binaryEncoding.toString());
        debugLog(myOtherStructureDataType.binaryEncodingDefinition.toString());
        debugLog("------------------------------------------------------------------------------");
        //xx debugLog(myStructureDataType.xmlEncoding.toString());
        debugLog(myOtherStructureDataType.xmlEncodingDefinition.toString());

        const options = {
            names: ["Hello", "World"],
            values: [
                {
                    lowValue: 50,
                    highValue: 100
                },
                {
                    lowValue: 51,
                    highValue: 101
                }
            ]
        };
        const op = addressSpace.constructExtensionObject(myOtherStructureDataType, options);

        op.constructor.name.should.eql("MyOtherStructure");
        console.log(op.toString());

        op.names.should.eql(["Hello", "World"]);
    });

    it("should bind an xml-preloaded Extension Object Variable : ServerStatus ", function(done) {
        // in this test, we verify that we can easily bind the Server_ServerStatus object
        // the process shall automatically bind variables and substructures recursively
        const VariableIds = require("node-opcua-constants").VariableIds;
        const makeNodeId = require("node-opcua-nodeid").makeNodeId;

        const serverStatus = addressSpace.findNode(makeNodeId(VariableIds.Server_ServerStatus));
        serverStatus.browseName.toString().should.eql("ServerStatus");

        // before bindExtensionObject is called, startTime property exists but is not bound
        serverStatus.should.have.property("startTime");
        serverStatus.startTime.readValue().value.dataType.should.eql(DataType.Null);
        serverStatus.readValue().value.dataType.should.eql(DataType.Null);

        //Xx value.startTime.should.eql(DataType.Null);
        //xx debugLog("serverStatus.startTime =",serverStatus.startTime.readValue().value.toString());

        serverStatus.bindExtensionObject();

        serverStatus
            .readValue()
            .value.value.startTime.toISOString()
            .should.eql("1601-01-01T00:00:00.000Z");
        serverStatus.startTime
            .readValue()
            .value.value.toISOString()
            .should.eql("1601-01-01T00:00:00.000Z");

        serverStatus.$extensionObject.startTime = new Date(Date.UTC(1800, 0, 1));

        serverStatus
            .readValue()
            .value.value.startTime.toISOString()
            .should.eql("1800-01-01T00:00:00.000Z");
        serverStatus.startTime
            .readValue()
            .value.value.toISOString()
            .should.eql("1800-01-01T00:00:00.000Z");

        serverStatus.startTime.setValueFromSource({
            dataType: DataType.DateTime,
            value: new Date(Date.UTC(2100, 0, 1))
        });

        serverStatus
            .readValue()
            .value.value.startTime.toISOString()
            .should.eql("2100-01-01T00:00:00.000Z");
        serverStatus.startTime
            .readValue()
            .value.value.toISOString()
            .should.eql("2100-01-01T00:00:00.000Z");
        //xx debugLog(serverStatus.readValue().value.toString());

        serverStatus.$extensionObject.buildInfo.productName = "productName1";
        serverStatus.readValue().value.value.buildInfo.productName.should.eql("productName1");
        serverStatus.buildInfo.productName.readValue().value.value.should.eql("productName1");

        serverStatus.buildInfo.productName.setValueFromSource({ dataType: DataType.String, value: "productName2" });
        serverStatus.readValue().value.value.buildInfo.productName.should.eql("productName2");
        serverStatus.buildInfo.productName.readValue().value.value.should.eql("productName2");

        const async = require("async");
        const StatusCodes = require("node-opcua-status-code").StatusCodes;
        const write_service = require("node-opcua-service-write");
        const WriteValue = write_service.WriteValue;
        const makeAccessLevel = require("node-opcua-data-model").makeAccessLevel;

        // now use WriteValue instead
        // make sure value is writable
        const rw = makeAccessLevel("CurrentRead | CurrentWrite");
        serverStatus.buildInfo.productName.accessLevel = rw;
        serverStatus.buildInfo.productName.userAccessLevel = rw;

        serverStatus.buildInfo.accessLevel = rw;
        serverStatus.buildInfo.userAccessLevel = rw;

        serverStatus.accessLevel = rw;
        serverStatus.userAccessLevel = rw;

        async.series(
            [
                function(callback) {
                    const writeValue = new WriteValue({
                        attributeId: 13, // value
                        value: {
                            statusCode: StatusCodes.Good,
                            value: {
                                dataType: DataType.String,
                                value: "productName3"
                            }
                        }
                    });
                    serverStatus.buildInfo.productName.writeAttribute(context, writeValue, function(err, statusCode) {
                        if (!err) {
                            statusCode.should.eql(StatusCodes.BadNotWritable);
                        }
                        callback(err);
                    });
                },
                function(callback) {
                    serverStatus.buildInfo.productName.readValue().value.value.should.not.eql("productName3");
                    serverStatus.readValue().value.value.buildInfo.productName.should.not.eql("productName3");
                    callback();
                }
            ],
            done
        );
    });

    it("should instantiate SessionDiagnostics in a linear time", function() {
        const utils = require("node-opcua-utils");
        const sessionDiagnosticsDataType = addressSpace.findDataType("SessionDiagnosticsDataType");
        const sessionDiagnosticsVariableType = addressSpace.findVariableType("SessionDiagnosticsVariableType");

        const objs = [];

        function createDiagnostic(index) {
            const t5 = utils.get_clock_tick();
            const sessionObject = addressSpace.addObject({
                browseName: "Session" + index,
                organizedBy: addressSpace.rootFolder.objects
            });

            // the extension object
            const t6 = utils.get_clock_tick();
            const _sessionDiagnostics = addressSpace.constructExtensionObject(sessionDiagnosticsDataType);
            const t7 = utils.get_clock_tick();
            const sessionDiagnostics = sessionDiagnosticsVariableType.instantiate({
                browseName: "SessionDiagnostics",
                componentOf: sessionObject,
                value: new Variant({ dataType: DataType.ExtensionObject, value: _sessionDiagnostics })
            });
            const t8 = utils.get_clock_tick();
            //xx debugLog(" t8-t7",t8-t7);

            objs.push(sessionObject);
        }

        for (let i = 0; i < 100; i++) {
            createDiagnostic(i);
        }
        objs.forEach(function(obj) {
            addressSpace.deleteNode(obj);
        });
    });
});
