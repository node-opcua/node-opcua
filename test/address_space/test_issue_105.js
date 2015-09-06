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

describe("testing github issue https://github.com/node-opcua/node-opcua/issues/105",function() {

    var address_space;
    before(function (done) {
        address_space = new AddressSpace();

        var xml_file = path.join(__dirname,"../../lib/server/mini.Node.Set2.xml");
        require("fs").existsSync(xml_file).should.be.eql(true);

        generate_address_space(address_space, xml_file, function (err) {

            // lets declare a custom folder Type
            var myFolderType = address_space.addObjectType({browseName: "MyFolderType",subtypeOf: "FolderType"});
            myFolderType.browseName.toString().should.eql("MyFolderType");
            myFolderType.subtypeOfObj.browseName.toString().should.eql("FolderType");

            done(err);
        });

    });


    it("should be possible to create an object organized by a folder whose type is a subtype of FolderType",function(){

        var temperatureSensorType = createTemperatureSensorType(address_space);

        //xx var folderType = address_space.findObjectType("FolderType");

        var myFolderType = address_space.findObjectType("MyFolderType");

        // now create a folder of type MyFolderType inside the RootFolder
        var myFolder = myFolderType.instantiate({browseName:"MyFolder",organizedBy:"RootFolder" });

        // now create a simple var inside the new folder (method 1)
        var myObject = address_space.addVariable(myFolder,{browseName:"Obj1",dataType:"Double"});
        myObject.browseName.toString().should.eql("Obj1");

        // now create a simple var isnide the new folder (method 2)
        var myObject2 = temperatureSensorType.instantiate({ browseName:"Obj2", organizedBy: myFolder});

        myObject2.browseName.toString().should.eql("Obj2");

    });

    it("AddressSpace#getFolder should handle folder whose type is FolderType",function() {

        var folderType = address_space.findObjectType("FolderType");

        var myFolder = folderType.instantiate({browseName:"MyFolderOfTypeFolderType",organizedBy:"RootFolder" });
        myFolder.browseName.toString().should.eql("MyFolderOfTypeFolderType");

        var verif1 = address_space.getFolder("MyFolderOfTypeFolderType");
        verif1.browseName.toString().should.eql("MyFolderOfTypeFolderType");

        var verif2 = address_space.getFolder(myFolder);
        verif2.browseName.toString().should.eql("MyFolderOfTypeFolderType");

        var verif3 = address_space.getFolder(myFolder.nodeId);
        verif3.browseName.toString().should.eql("MyFolderOfTypeFolderType");

        var verif4 = address_space.getFolder(myFolder.nodeId.toString());
        verif4.browseName.toString().should.eql("MyFolderOfTypeFolderType");
    });

    it("AddressSpace#getFolder should handle folder whose type is a subtype of FolderType",function() {

        var myFolderType = address_space.findObjectType("MyFolderType");

        // now create a folder of type MyFolderType inside the RootFolder
        var myFolderOfTypeMyFolderType = myFolderType.instantiate({browseName:"MyFolderOfTypeMyFolderType",organizedBy:"RootFolder" });
        myFolderOfTypeMyFolderType.browseName.toString().should.eql("MyFolderOfTypeMyFolderType");


        var verif1 = address_space.getFolder("MyFolderOfTypeMyFolderType");
        verif1.browseName.toString().should.eql("MyFolderOfTypeMyFolderType");

        var verif2 = address_space.getFolder(myFolderOfTypeMyFolderType);
        verif2.browseName.toString().should.eql("MyFolderOfTypeMyFolderType");

        var verif3 = address_space.getFolder(myFolderOfTypeMyFolderType.nodeId);
        verif3.browseName.toString().should.eql("MyFolderOfTypeMyFolderType");

        var verif4 = address_space.getFolder(myFolderOfTypeMyFolderType.nodeId.toString());
        verif4.browseName.toString().should.eql("MyFolderOfTypeMyFolderType");
    });

    it("AddressSpace#getFolder should return null folder cannot be found",function() {

        should(address_space.getFolder("ns=1;s=UnknownFolder")).eql(null);
    });


    it("AddressSpace#getFolder should raise an exception if argunement does'nt resolved to a folder",function() {

        var serverObj =  address_space.findObject("Server");
        serverObj.nodeId.toString().should.eql("ns=0;i=2253");

        should(function() {
            address_space.getFolder(serverObj);
        }).throwError();

        should(function() {
            address_space.getFolder(serverObj.browseName.toString());
        }).throwError();

        should(function() {
            address_space.getFolder(serverObj.nodeId.toString());
        }).throwError();

    });

});
