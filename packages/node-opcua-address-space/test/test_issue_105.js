"use strict";
/* global it,before*/

var should = require("should");
var get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;
var createTemperatureSensorType = require("./fixture_temperature_sensor_type").createTemperatureSensorType;

var assertHasMatchingReference = require("../test_helpers/assertHasMatchingReference");

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("testing github issue https://github.com/node-opcua/node-opcua/issues/105", function () {

    var addressSpace;

    before(function (done) {
        get_mini_address_space(function (err, __addressSpace__) {
            addressSpace = __addressSpace__;

            // lets declare a custom folder Type
            var myFolderType = addressSpace.addObjectType({browseName: "MyFolderType", subtypeOf: "FolderType"});
            myFolderType.browseName.toString().should.eql("MyFolderType");
            myFolderType.subtypeOfObj.browseName.toString().should.eql("FolderType");

            done(err);
        });

    });
    after(function (done) {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        done();
    });

    it("should be possible to create an object organized by a folder whose type is a subtype of FolderType", function () {

        var temperatureSensorType = createTemperatureSensorType(addressSpace);

        //xx var folderType = addressSpace.findObjectType("FolderType");

        var myFolderType = addressSpace.findObjectType("MyFolderType");

        // now create a folder of type MyFolderType inside the Objects Folder
        var myFolder = myFolderType.instantiate({browseName: "MyFolder", organizedBy: "ObjectsFolder"});

        // now create a simple var inside the new folder (method 1)
        var myObject = addressSpace.addVariable({
            organizedBy: myFolder,
            browseName: "Obj1",
            dataType: "Double"
        });
        myObject.browseName.toString().should.eql("Obj1");

        // now create a simple var isnide the new folder (method 2)
        var myObject2 = temperatureSensorType.instantiate({browseName: "Obj2", organizedBy: myFolder});

        myObject2.browseName.toString().should.eql("Obj2");

        assertHasMatchingReference(myFolder, {referenceType: "Organizes", nodeId: myObject2.nodeId});

    });
});
