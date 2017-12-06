"use strict";
/* global describe,it,before*/

var should = require("should");
var _ = require("underscore");


var StatusCodes = require("node-opcua-status-code").StatusCodes;
var DataType = require("node-opcua-variant").DataType;
var AttributeIds = require("node-opcua-data-model").AttributeIds;


var get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;

var address_space = require("..");
var UAMethod = address_space.UAMethod;
var SessionContext = address_space.SessionContext;
var context = SessionContext.defaultContext;

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("testing Method -  Attribute UserExecutable & Executable on Method ", function () {

    var addressSpace;

    before(function () {
        addressSpace = new address_space.AddressSpace();
    });
    after(function (done) {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        done();
    });

    it("should return Executable= false and UserExecutable=false if method is not bound ", function () {

        var method = new UAMethod({
            browseName: "MyMethod1",
            addressSpace: addressSpace,
            userExecutable: false,
            executable: true
        });

        var value;
        value = method.readAttribute(context, AttributeIds.UserExecutable);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.dataType.should.eql(DataType.Boolean);
        value.value.value.should.equal(false);

        value = method.readAttribute(context, AttributeIds.Executable);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.dataType.should.eql(DataType.Boolean);
        value.value.value.should.equal(false);

    });
    it("should return Executable= true and UserExecutable=true if method is  bound ", function () {

        var method = new UAMethod({
            browseName: "MyMethod2",
            addressSpace: addressSpace,
            userExecutable: false,
            executable: true
        });

        function fakeMethod() {
        }

        method.bindMethod(fakeMethod);

        var value;
        value = method.readAttribute(context, AttributeIds.UserExecutable);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.dataType.should.eql(DataType.Boolean);
        value.value.value.should.equal(true);

        value = method.readAttribute(context, AttributeIds.Executable);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.dataType.should.eql(DataType.Boolean);
        value.value.value.should.equal(true);

    });

});

describe("testing Method in address space", function () {


    var addressSpace = null;
    before(function (done) {
        get_mini_address_space(function (err, data) {
            addressSpace = data;
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
    it("should provide a way to find a Method object by nodeId", function () {

        should(addressSpace.findMethod("ns=0;i=11489")).be.instanceOf(UAMethod);
        should(addressSpace.findNode("ns=0;i=11489")).be.instanceOf(UAMethod);

    });
    it("should provide a way to find a Method object by nodeId", function () {

        should(addressSpace.findMethod("ns=0;i=11492")).be.instanceOf(UAMethod);
        should(addressSpace.findNode("ns=0;i=11492")).be.instanceOf(UAMethod);

    });

    it("should provide a input Parameter variable", function () {

        var method = addressSpace.findMethod("ns=0;i=11489");
        method.should.be.instanceOf(UAMethod);
        var inputArguments = method.getInputArguments();
        inputArguments.should.be.instanceOf(Object);

    });
    it("should provide a output Parameter variable", function () {

        var method = addressSpace.findMethod("ns=0;i=11489");
        method.should.be.instanceOf(UAMethod);

        var outputArguments = method.getOutputArguments();
        outputArguments.should.be.instanceOf(Object);


    });


});

describe("testing Method binding", function () {
    var addressSpace = null;
    var rootFolder;

    before(function (done) {
        get_mini_address_space(function (err, data) {
            addressSpace = data;
            rootFolder = addressSpace.rootFolder;
            rootFolder.browseName.toString().should.equal("Root");
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

    function fake_getMonitoredItemId(inputArguments, context, callback) {

        var self = this;

        should(_.isArray(inputArguments)).eql(true);
        should(_.isFunction(callback)).eql(true);


        inputArguments[0].dataType.should.eql(DataType.UInt32);
        inputArguments[0].value.should.eql(5);

        var myResult = {
            statusCode: StatusCodes.BadBoundNotFound,
            outputArguments: [
                {dataType: DataType.UInt32, value: [1, 2, 3]},
                {dataType: DataType.UInt32, value: [4, 5, 6]}
            ]
        };
        callback(null, myResult);

    }

    it("should bind a method  ", function (done) {

        rootFolder.objects.server.getMonitoredItems.bindMethod(fake_getMonitoredItemId.bind(this));

        var inputArguments = [{dataType: DataType.UInt32, value: 5}];

        var context = SessionContext.defaultContext;
        rootFolder.objects.server.getMonitoredItems.execute(inputArguments, context, function (err, result) {

            done(err);
        });
    });
});


