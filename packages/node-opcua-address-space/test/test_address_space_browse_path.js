"use strict";
const should = require("should");

const get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;

const add_eventGeneratorObject = require("../test_helpers/add_event_generator_object").add_eventGeneratorObject;

const StatusCodes = require("node-opcua-status-code").StatusCodes;


const makeBrowsePath = require("node-opcua-service-translate-browse-path").makeBrowsePath;

const doDebug = false;

describe("AddressSpace#browsePath", function () {

    let addressSpace = null;

    before(function(done) {
        get_mini_address_space(function (err, data) {
            addressSpace = data;

            // Add EventGeneratorObject
            add_eventGeneratorObject(addressSpace,"ObjectsFolder");

            done(err);
        });
    });

    after(function(){
        if (addressSpace){
            addressSpace.dispose();
            addressSpace = null;
        }
    });

    it("should browse Server",function() {

        const browsePath = makeBrowsePath("RootFolder","/Objects/Server");
        const result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.Good);
        result.targets.length.should.eql(1);

        if (doDebug) {
            const opts = {addressSpace: addressSpace};
            console.log(result.toString(opts));
        }
    });
    it("should browse Status",function() {

        const browsePath = makeBrowsePath("RootFolder","/Objects/Server/ServerStatus");
        const result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.Good);
        result.targets.length.should.eql(1);

        if (doDebug) {
            const opts = {addressSpace: addressSpace};
            console.log(result.toString(opts));

        }
    });
    it("#QQ browsing a path when a null target name is not in the last element shall return an error ",function() {

        const browsePath = makeBrowsePath("RootFolder","/Objects/Server/ServerStatus");
        browsePath.relativePath.elements[1].targetName.toString().should.eql("Server");
        // set a null target Name in the middle of the path
        browsePath.relativePath.elements[1].targetName = null;
        const result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.BadBrowseNameInvalid);
        result.targets.length.should.eql(0);
    });


    it("should browse EventGeneratorObject",function() {
        const browsePath = makeBrowsePath("RootFolder","/Objects/EventGeneratorObject");
        const result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.Good);
        result.targets.length.should.eql(1);

        if (doDebug) {
            const opts = {addressSpace: addressSpace};
            console.log("browsePath", browsePath.toString(opts));
            console.log("result", result.toString(opts));

            console.log(addressSpace.rootFolder.objects.toString());
        }
    });

    it("should browse MyEventType",function() {

        let browsePath = makeBrowsePath("RootFolder", "/Types/EventTypes/BaseEventType<HasSubtype>MyEventType");
        let result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.Good);
        result.targets.length.should.eql(1);

        if (doDebug) {
            const opts = {addressSpace: addressSpace};
            console.log("browsePath", browsePath.toString(opts));
            console.log("result", result.toString(opts));
        }

        const node  = addressSpace.findNode(result.targets[0].targetId).browseName.toString().should.eql("MyEventType");

        browsePath = makeBrowsePath("RootFolder", "/Types/EventTypes/BaseEventType<!HasSubtype>MyEventType");
        result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.BadNoMatch);

        browsePath = makeBrowsePath("RootFolder", "/Types/EventTypes/BaseEventType<#HasSubtype>MyEventType");
        result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.Good);

        const evType = addressSpace.findNode(result.targets[0].targetId);

        // rowing upstream
        browsePath = makeBrowsePath(evType,"<!HasSubtype>BaseEventType<!Organizes>EventTypes<!Organizes>Types<!Organizes>Root");
        result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.Good);
        addressSpace.findNode(result.targets[0].targetId).browseName.toString().should.eql("Root");

    });
    it("should browse an empty path",function() {

        const rootFolder = addressSpace.rootFolder;
        const browsePath = makeBrowsePath(rootFolder, "");
        const result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.BadNothingToDo);
        result.targets.length.should.eql(0);


    });
});


