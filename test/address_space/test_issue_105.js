"use strict";
/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");
var Method = require("lib/address_space/ua_method").Method;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var UAObjectType = require("lib/address_space/ua_object_type").UAObjectType;

var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;
var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var _ = require("underscore");
var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var assert = require("better-assert");
var path = require("path");
var createTemperatureSensorType = require("./fixture_temperature_sensor_type").createTemperatureSensorType;

var assertHasMatchingReference = require("../helpers/assertHasMatchingReference");

describe("testing github issue https://github.com/node-opcua/node-opcua/issues/105",function() {

    var addressSpace;
    before(function (done) {
        addressSpace = new AddressSpace();

        var xml_file = path.join(__dirname,"../../lib/server/mini.Node.Set2.xml");
        require("fs").existsSync(xml_file).should.be.eql(true);

        generate_address_space(addressSpace, xml_file, function (err) {

            // lets declare a custom folder Type
            var myFolderType = addressSpace.addObjectType({browseName: "MyFolderType",subtypeOf: "FolderType"});
            myFolderType.browseName.toString().should.eql("MyFolderType");
            myFolderType.subtypeOfObj.browseName.toString().should.eql("FolderType");

            done(err);
        });

    });


    it("should be possible to create an object organized by a folder whose type is a subtype of FolderType",function(){

        var temperatureSensorType = createTemperatureSensorType(addressSpace);

        //xx var folderType = addressSpace.findObjectType("FolderType");

        var myFolderType = addressSpace.findObjectType("MyFolderType");

        // now create a folder of type MyFolderType inside the Objects Folder
        var myFolder = myFolderType.instantiate({browseName:"MyFolder",organizedBy:"ObjectsFolder" });

        // now create a simple var inside the new folder (method 1)
        var myObject = addressSpace.addVariable({
            organizedBy: myFolder,
            browseName:  "Obj1",
            dataType:    "Double"
        });
        myObject.browseName.toString().should.eql("Obj1");

        // now create a simple var isnide the new folder (method 2)
        var myObject2 = temperatureSensorType.instantiate({ browseName:"Obj2", organizedBy: myFolder});

        myObject2.browseName.toString().should.eql("Obj2");

        assertHasMatchingReference(myFolder,{ referenceType: "Organizes",  nodeId: myObject2.nodeId });

    });

    it("AddressSpace#getFolder should handle folder whose type is FolderType",function() {

        var folderType = addressSpace.findObjectType("FolderType");

        var myFolder = folderType.instantiate({browseName:"MyFolderOfTypeFolderType",organizedBy:"RootFolder" });
        myFolder.browseName.toString().should.eql("MyFolderOfTypeFolderType");

        var verif1 = addressSpace.getFolder("MyFolderOfTypeFolderType");
        verif1.browseName.toString().should.eql("MyFolderOfTypeFolderType");

        var verif2 = addressSpace.getFolder(myFolder);
        verif2.browseName.toString().should.eql("MyFolderOfTypeFolderType");

        var verif3 = addressSpace.getFolder(myFolder.nodeId);
        verif3.browseName.toString().should.eql("MyFolderOfTypeFolderType");

        var verif4 = addressSpace.getFolder(myFolder.nodeId.toString());
        verif4.browseName.toString().should.eql("MyFolderOfTypeFolderType");
    });

    it("AddressSpace#getFolder should handle folder whose type is a subtype of FolderType",function() {

        var myFolderType = addressSpace.findObjectType("MyFolderType");

        // now create a folder of type MyFolderType inside the RootFolder
        var myFolderOfTypeMyFolderType = myFolderType.instantiate({browseName:"MyFolderOfTypeMyFolderType",organizedBy:"RootFolder" });
        myFolderOfTypeMyFolderType.browseName.toString().should.eql("MyFolderOfTypeMyFolderType");


        var verif1 = addressSpace.getFolder("MyFolderOfTypeMyFolderType");
        verif1.browseName.toString().should.eql("MyFolderOfTypeMyFolderType");

        var verif2 = addressSpace.getFolder(myFolderOfTypeMyFolderType);
        verif2.browseName.toString().should.eql("MyFolderOfTypeMyFolderType");

        var verif3 = addressSpace.getFolder(myFolderOfTypeMyFolderType.nodeId);
        verif3.browseName.toString().should.eql("MyFolderOfTypeMyFolderType");

        var verif4 = addressSpace.getFolder(myFolderOfTypeMyFolderType.nodeId.toString());
        verif4.browseName.toString().should.eql("MyFolderOfTypeMyFolderType");
    });

    it("AddressSpace#getFolder should return null folder cannot be found",function() {

        should(addressSpace.getFolder("ns=1;s=UnknownFolder")).eql(null);
    });


    it("AddressSpace#getFolder should raise an exception if argunement does'nt resolved to a folder",function() {

        var serverObj =  addressSpace.findObject("Server");
        serverObj.nodeId.toString().should.eql("ns=0;i=2253");

        should(function() {
            addressSpace.getFolder(serverObj);
        }).throwError();

        should(function() {
            addressSpace.getFolder(serverObj.browseName.toString());
        }).throwError();

        should(function() {
            addressSpace.getFolder(serverObj.nodeId.toString());
        }).throwError();

    });

});
