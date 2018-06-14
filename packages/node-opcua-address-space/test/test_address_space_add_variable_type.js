"use strict";
/* global describe,it,before*/

require("should");

const _ = require("underscore");

const get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;
const NodeClass = require("node-opcua-data-model").NodeClass;


const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("testing add new ObjectType ", function () {

    let addressSpace,namespace;

    before(function (done) {
        get_mini_address_space(function (err, __addressSpace__) {
            addressSpace = __addressSpace__;
            namespace = addressSpace.getPrivateNamespace();

            done(err);
        });
    });
    after(function () {
        addressSpace.dispose();
        addressSpace = null;
    });
    it("should add a new ObjectType (=> BaseObjectType)", function () {

        const myObjectType = namespace.addObjectType({browseName: "MyObjectType"});
        myObjectType.browseName.toString().should.eql("1:MyObjectType");
        myObjectType.subtypeOfObj.browseName.toString().should.eql("BaseObjectType");
        myObjectType.nodeClass.should.eql(NodeClass.ObjectType);
    });
    it("should add a new VariableType (=> BaseVariableType)", function () {

        const myVariableType = namespace.addVariableType({browseName: "MyVariableType"});
        myVariableType.browseName.toString().should.eql("1:MyVariableType");
        myVariableType.subtypeOfObj.browseName.toString().should.eql("BaseVariableType");
        myVariableType.nodeClass.should.eql(NodeClass.VariableType);

    });
    it("should add a new VariableType (=> BaseDataVariableType)", function () {

        const myVariableType = namespace.addVariableType({
            browseName: "MyVariableType2",
            subtypeOf: "BaseDataVariableType"
        });
        myVariableType.browseName.toString().should.eql("1:MyVariableType2");
        myVariableType.subtypeOfObj.browseName.toString().should.eql("BaseDataVariableType");
        myVariableType.nodeClass.should.eql(NodeClass.VariableType);

    });
});
