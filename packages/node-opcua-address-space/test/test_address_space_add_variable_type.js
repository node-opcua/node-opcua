"use strict";
/* global describe,it,before*/

require("should");

var _ = require("underscore");

var get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;
var NodeClass = require("node-opcua-data-model").NodeClass;


var describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("testing add new ObjectType ", function () {

    var addressSpace;

    before(function (done) {
        get_mini_address_space(function (err, __addressSpace__) {
            addressSpace = __addressSpace__;
            done(err);
        });
    });
    after(function () {
        addressSpace.dispose();
        addressSpace = null;
    });
    it("should add a new ObjectType (=> BaseObjectType)", function () {

        var myObjectType = addressSpace.addObjectType({browseName: "MyObjectType"});
        myObjectType.browseName.toString().should.eql("MyObjectType");
        myObjectType.subtypeOfObj.browseName.toString().should.eql("BaseObjectType");
        myObjectType.nodeClass.should.eql(NodeClass.ObjectType);
    });
    it("should add a new VariableType (=> BaseVariableType)", function () {

        var myVariableType = addressSpace.addVariableType({browseName: "MyVariableType"});
        myVariableType.browseName.toString().should.eql("MyVariableType");
        myVariableType.subtypeOfObj.browseName.toString().should.eql("BaseVariableType");
        myVariableType.nodeClass.should.eql(NodeClass.VariableType);

    });
    it("should add a new VariableType (=> BaseDataVariableType)", function () {

        var myVariableType = addressSpace.addVariableType({
            browseName: "MyVariableType2",
            subtypeOf: "BaseDataVariableType"
        });
        myVariableType.browseName.toString().should.eql("MyVariableType2");
        myVariableType.subtypeOfObj.browseName.toString().should.eql("BaseDataVariableType");
        myVariableType.nodeClass.should.eql(NodeClass.VariableType);

    });
});
