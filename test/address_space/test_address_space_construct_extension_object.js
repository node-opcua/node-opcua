// =====================================================================================================================
// the objective of this test is to check the ability to create a extension object from it's node
// id out of the address_space
//
// For instance if ServerStatus
//    var ServerStatusDataType = address_space.findDataType("ServerStatus");
//    var serverStatus  = address_space.constructExtensionObject(ServerStatusDataType);
//    serverStatus.constructor.name.should.eql("ServerStatus");
//
//
"use strict";
require("requirish")._(module);
var should = require("should");
var assert = require("assert");
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



describe("testing  address space namespace loading", function () {

    var address_space = new AddressSpace();
    before(function (done) {

        var xml_files = [
           path.join(__dirname, "../../nodesets/Opc.Ua.NodeSet2.xml"),
           path.join(__dirname, "../../modeling/my_data_type.xml")
        ];
        fs.existsSync(xml_files[0]).should.be.eql(true);
        //Xx fs.existsSync(xml_files[1]).should.be.eql(true);

        address_space.registerNamespace("ServerNamespaceURI");
        address_space.getNamespaceArray().length.should.eql(2);

        generate_address_space(address_space, xml_files, function (err) {
            done(err);
        });
    });


    it("should process namespaces and translate namespace index when loading node set xml files", function (done) {


        var serverStatusDataType = address_space.findDataType("ServerStatusDataType");
        serverStatusDataType.should.be.instanceOf(UADataType);

        serverStatusDataType.browseName.toString().should.eql("ServerStatusDataType");

        var serverStatus  = address_space.constructExtensionObject(serverStatusDataType);
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

        var attributeOperand = address_space.findDataType("AttributeOperand");
        attributeOperand.should.be.instanceOf(UADataType);

        attributeOperand.browseName.toString().should.eql("AttributeOperand");

        var op  = address_space.constructExtensionObject(attributeOperand);
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

    it("should create a arbitrary structure from a second name space",function(done){

        var r = require("lib/data_access/EUInformation");
        var ns = address_space.getNamespaceIndex("http://yourorganisation.org/my_data_type/");
        ns.should.eql(2);
        var myStructureDataType = address_space.findDataType("MyStructureDataType",ns);
        myStructureDataType.should.be.instanceOf(UADataType);

        //------------------------------------------------------------------------------
        // create an extension object
        //------------------------------------------------------------------------------
        var op  = address_space.constructExtensionObject(myStructureDataType);
        op.constructor.name.should.eql("MyStructure");

        op.should.have.property("lowValue");
        op.lowValue.should.eql(0);

        //xx console.log("op.lowValue",op.lowValue.toString());


        //------------------------------------------------------------------------------
        // create a variable
        //------------------------------------------------------------------------------
        var myStructureType = address_space.findVariableType("MyStructureType",ns);
        myStructureType.should.be.instanceOf(UAVariableType);

        var folder = address_space.addFolder("RootFolder", {browseName: "MyDevices"});
        assert(folder.nodeId);
        folder.should.be.instanceOf(UAObject);
        var myVar = myStructureType.instantiate({
            browseName:"MyVar",
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
});

