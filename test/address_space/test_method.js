"use strict";
/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");
var UAMethod = require("lib/address_space/ua_method").UAMethod;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;
var address_space = require("lib/address_space/address_space");
var get_mini_address_space = require("test/fixtures/fixture_mininodeset_address_space").get_mini_address_space;
var _ = require("underscore");

describe("testing Method -  Attribute UserExecutable & Executable on Method ", function () {

    var the_address_space;
    before(function () {
        the_address_space = new address_space.AddressSpace();
    });

    it("should return Executable= false and UserExecutable=false if method is not bound ", function () {

        var method = new UAMethod({
            browseName: "MyMethod1",
            address_space: the_address_space,
            userExecutable: false,
            executable: true
        });

        var value;
        value = method.readAttribute(AttributeIds.UserExecutable);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.dataType.should.eql(DataType.Boolean);
        value.value.value.should.equal(false);

        value = method.readAttribute(AttributeIds.Executable);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.dataType.should.eql(DataType.Boolean);
        value.value.value.should.equal(false);

    });
    it("should return Executable= true and UserExecutable=true if method is  bound ", function () {

        var method = new UAMethod({
            browseName: "MyMethod2",
            address_space: the_address_space,
            userExecutable: false,
            executable: true
        });

        function fakeMethod() {
        }

        method.bindMethod(fakeMethod);

        var value;
        value = method.readAttribute(AttributeIds.UserExecutable);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.dataType.should.eql(DataType.Boolean);
        value.value.value.should.equal(true);

        value = method.readAttribute(AttributeIds.Executable);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.dataType.should.eql(DataType.Boolean);
        value.value.value.should.equal(true);

    });

});

describe("testing Method in address space", function () {


    var address_space = null;
    before(function (done) {
        get_mini_address_space(function (err, data) {
            address_space = data;
            done(err);
        });
    });

    it("should provide a way to find a Method object by nodeId", function () {

        should(address_space.findMethod("ns=0;i=11489")).be.instanceOf(UAMethod);
        should(address_space.findObject("ns=0;i=11489")).be.instanceOf(UAMethod);

    });
    it("should provide a way to find a Method object by nodeId", function () {

        should(address_space.findMethod("ns=0;i=11492")).be.instanceOf(UAMethod);
        should(address_space.findObject("ns=0;i=11492")).be.instanceOf(UAMethod);

    });

    it("should provide a input Parameter variable", function () {

        var method = address_space.findMethod("ns=0;i=11489");
        method.should.be.instanceOf(UAMethod);
        var inputArguments = method.getInputArguments();
        inputArguments.should.be.instanceOf(Object);

    });
    it("should provide a output Parameter variable", function () {

        var method = address_space.findMethod("ns=0;i=11489");
        method.should.be.instanceOf(UAMethod);

        var outputArguments = method.getOutputArguments();
        outputArguments.should.be.instanceOf(Object);


    });


});
describe("testing Method binding", function () {
    var address_space = null;
    var rootFolder;

    before(function (done) {
        get_mini_address_space(function (err, data) {
            address_space = data;
            rootFolder = address_space.findObjectByBrowseName("Root");
            rootFolder.browseName.toString().should.equal("Root");
            done(err);
        });
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
        var context = {};

        rootFolder.objects.server.getMonitoredItems.execute(inputArguments, context, function (err, result) {

            done(err);
        });
    });
});


