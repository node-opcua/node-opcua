// =====================================================================================================================
// the objective of this test is to check the ability to create a extension object from it's node
// id out of the address_space
//
// For instance if ServerStatus
//    var ServerStatusDataType = addressSpace.findDataType("ServerStatus");
//    var serverStatus  = addressSpace.constructExtensionObject(ServerStatusDataType);
//    serverStatus.constructor.name.should.eql("ServerStatus");
//
//
    "use strict";
    require("requirish")._(module);
    var should = require("should");
    var assert = require("better-assert");
    var path = require("path");

    var get_mini_address_space = require("test/fixtures/fixture_mininodeset_address_space").get_mini_address_space;

    var NodeId = require("lib/datamodel/nodeid").NodeId;

    var AddressSpace = require("lib/address_space/address_space").AddressSpace;

    // make sure all namespace 0 data type are properly loaded
    var Engine = require("lib/server/server_engine");

    var fs = require("fs");
    var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;


    var UADataType = require("lib/address_space/ua_data_type").UADataType;
    var UAVariableType = require("lib/address_space/ua_variable_type").UAVariableType;
    var UAObject = require("lib/address_space/ua_object").UAObject;
    var DataType = require("lib/datamodel/variant").DataType;
    var Variant = require("lib/datamodel/variant").Variant;


    describe("testing address space namespace loading", function () {

        this.timeout(Math.max(300000,this._timeout));

        var addressSpace;
        require("test/helpers/resource_leak_detector").installResourceLeakDetector(true,function() {
            before(function (done) {

                addressSpace = new AddressSpace();
                var xml_files = [
                    path.join(__dirname, "../../nodesets/Opc.Ua.NodeSet2.xml"),
                    path.join(__dirname, "../../modeling/my_data_type.xml")
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
        });
    it("should process namespaces and translate namespace index when loading node set xml files", function (done) {

        var serverStatusDataType = addressSpace.findDataType("ServerStatusDataType");
        serverStatusDataType.should.be.instanceOf(UADataType);

        serverStatusDataType.browseName.toString().should.eql("ServerStatusDataType");

        var serverStatus  = addressSpace.constructExtensionObject(serverStatusDataType);
        serverStatus.constructor.name.should.eql("ServerStatus");

        serverStatus.should.have.property("startTime");
        serverStatus.should.have.property("startTime");

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

        var op  = addressSpace.constructExtensionObject(attributeOperand);
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

    it("ZZ should create a arbitrary structure from a second name space",function(done){

        var r = require("lib/data_access/EUInformation");
        var ns = addressSpace.getNamespaceIndex("http://yourorganisation.org/my_data_type/");
        ns.should.eql(2);
        var myStructureDataType = addressSpace.findDataType("MyStructureDataType",ns);
        myStructureDataType.should.be.instanceOf(UADataType);

        //------------------------------------------------------------------------------
        // create an extension object
        //------------------------------------------------------------------------------
        var op  = addressSpace.constructExtensionObject(myStructureDataType);
        op.constructor.name.should.eql("MyStructure");

        op.should.have.property("lowValue");
        op.lowValue.should.eql(0);

        //xx console.log("op.lowValue",op.lowValue.toString());


        //------------------------------------------------------------------------------
        // create a variable
        //------------------------------------------------------------------------------
        var myStructureType = addressSpace.findVariableType("MyStructureType",ns);
        myStructureType.should.be.instanceOf(UAVariableType);

        var folder = addressSpace.addFolder("ObjectsFolder", {browseName: "MyDevices"});
        assert(folder.nodeId);
        folder.should.be.instanceOf(UAObject);


        console.log(" myStructureType = ",myStructureType.toString());

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

        myVar.lowValue.readValueAsync( function(err,dataValue){
            dataValue.value.value.should.eql(10);
            done(err);
        });
    });

    it("AA explore the DataType through OPCUA",function() {

        var ns = addressSpace.getNamespaceIndex("http://yourorganisation.org/my_data_type/");
        ns.should.eql(2);
        var myStructureDataType = addressSpace.findDataType("MyStructureDataType",ns);
        myStructureDataType.should.be.instanceOf(UADataType);

        console.log(myStructureDataType.toString());

        // find the encoding
        //Xx console.log(myStructureDataType.binaryEncoding.toString());

        console.log(myStructureDataType.binaryEncodingDefinition.toString());
        console.log("------------------------------------------------------------------------------")
        //xx console.log(myStructureDataType.xmlEncoding.toString());
        console.log(myStructureDataType.xmlEncodingDefinition.toString());

    });
    it("AB explore the DataType through OPCUA",function() {

        var ns = addressSpace.getNamespaceIndex("http://yourorganisation.org/my_data_type/");
        ns.should.eql(2);
        var myOtherStructureDataType = addressSpace.findDataType("MyOtherStructureDataType",ns);
        myOtherStructureDataType.should.be.instanceOf(UADataType);

        console.log(myOtherStructureDataType.toString());

        // find the encoding
        //xx console.log(myStructureDataType.binaryEncoding.toString());
        console.log(myOtherStructureDataType.binaryEncodingDefinition.toString());
        console.log("------------------------------------------------------------------------------")
        //xx console.log(myStructureDataType.xmlEncoding.toString());
        console.log(myOtherStructureDataType.xmlEncodingDefinition.toString());

    });



    it("should bind an xml-preloaded Extension Object Variable : ServerStatus ",function(done) {
        // in this test, we verify that we can easily bind the Server_ServerStatus object
        // the process shall automatically bind variables and substructures recursively
        var VariableIds = require("lib/opcua_node_ids").VariableIds;
        var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;

        var serverStatus = addressSpace.findNode(makeNodeId(VariableIds.Server_ServerStatus));
        serverStatus.browseName.toString().should.eql("ServerStatus");

        // before bindExtensionObject is called, startTime property exists but is not bound
        serverStatus.should.have.property("startTime");
        serverStatus.startTime.readValue().value.dataType.should.eql(DataType.Null);
        serverStatus.readValue().value.dataType.should.eql(DataType.Null);

        //Xx value.startTime.should.eql(DataType.Null);
        //xx console.log("serverStatus.startTime =",serverStatus.startTime.readValue().value.toString());


        serverStatus.bindExtensionObject();

        serverStatus.readValue().value.value.startTime.toISOString().should.eql("1601-01-01T00:00:00.000Z");
        serverStatus.startTime.readValue().value.value.toISOString().should.eql("1601-01-01T00:00:00.000Z");

        serverStatus.readValue().value.value.startTime = new Date(Date.UTC(1800,0,1));
        serverStatus.readValue().value.value.startTime.toISOString().should.eql("1800-01-01T00:00:00.000Z");
        serverStatus.startTime.readValue().value.value.toISOString().should.eql("1800-01-01T00:00:00.000Z");


        serverStatus.startTime.setValueFromSource({dataType: DataType.DateTime, value: new Date(Date.UTC(2100,0,1))});
        serverStatus.readValue().value.value.startTime.toISOString().should.eql("2100-01-01T00:00:00.000Z");
        serverStatus.startTime.readValue().value.value.toISOString().should.eql("2100-01-01T00:00:00.000Z");
        //xx console.log(serverStatus.readValue().value.toString());


        serverStatus.readValue().value.value.buildInfo.productName = "productName1";
        serverStatus.readValue().value.value.buildInfo.productName.should.eql("productName1");
        serverStatus.buildInfo.productName.readValue().value.value.should.eql("productName1");

        serverStatus.buildInfo.productName.setValueFromSource({ dataType: DataType.String, value: "productName2"});
        serverStatus.readValue().value.value.buildInfo.productName.should.eql("productName2");
        serverStatus.buildInfo.productName.readValue().value.value.should.eql("productName2");

        var async = require("async");
        var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
        var write_service = require("lib/services/write_service");
        var WriteValue = write_service.WriteValue;
        var makeAccessLevel = require("lib/datamodel/access_level").makeAccessLevel;

        // now use WriteValue instead
        // make sure value is writable
        var rw = makeAccessLevel("CurrentRead | CurrentWrite");
        serverStatus.buildInfo.productName.accessLevel =  rw;
        serverStatus.buildInfo.productName.userAccessLevel =  rw;

        serverStatus.buildInfo.accessLevel =  rw;
        serverStatus.buildInfo.userAccessLevel =  rw;

        serverStatus.accessLevel =  rw;
        serverStatus.userAccessLevel =  rw;

        async.series([
            function(callback) {

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
                serverStatus.buildInfo.productName.writeAttribute(writeValue, function(err,statusCode){
                    if (!err) {
                        statusCode.should.eql(StatusCodes.Good);
                    }
                    callback(err);
                });

            },
            function(callback) {
                serverStatus.buildInfo.productName.readValue().value.value.should.eql("productName3");
                serverStatus.readValue().value.value.buildInfo.productName.should.eql("productName3");
                callback();
            }
        ],done);
    });

    it("xxx should instantiate SessionDiagnostics in a linear time",function() {

        var utils = require("lib/misc/utils");
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
                value: new Variant({ dataType: DataType.ExtensionObject, value:  _sessionDiagnostics })
            });
            var t8 = utils.get_clock_tick();
            //xx console.log(" t8-t7",t8-t7);

            objs.push(sessionObject);
        }
        for (var i=0;i<10; i++) {
            createDiagnostic(i);
        }
        objs.forEach(function(obj) {
            addressSpace.deleteNode(obj);
        });
    });

});

