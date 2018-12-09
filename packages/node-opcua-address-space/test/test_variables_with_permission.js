"use strict";
/* global describe,it,before*/

const should = require("should");
const StatusCodes = require("node-opcua-status-code");

const get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;

const DataType = require("node-opcua-variant").DataType;
const DataValue = require("node-opcua-data-value").DataValue;

const BrowseDescription = require("node-opcua-service-browse").BrowseDescription;
const BrowseDirection = require("node-opcua-data-model").BrowseDirection;
const AttributeIds = require("node-opcua-data-model").AttributeIds;
const SessionContext = require("../").SessionContext;
const AccessLevelFlag = require("node-opcua-data-model").AccessLevelFlag;


require("../src/address_space_add_enumeration_type");
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("AddressSpace : testing add enumeration type", function () {

    let addressSpace, namespace;
    let variable;

    before(function (done) {
        get_mini_address_space(function (err, __addressSpace__) {
            addressSpace = __addressSpace__;
            namespace = addressSpace.getOwnNamespace();

            variable = namespace.addVariable({
                browseName: "SomeVar",
                dataType: "Double",
                accessLevel: 0x3F,
                userAccessLevel: 0x3F
            });
            done(err);
        });

    });
    after(function () {
        addressSpace.dispose();
        addressSpace = null;
    });

    it("should adjust userAccessLevel based on session Context permission", function () {

        variable.userAccessLevel.should.eql(0x3F);

        const dataValue1 = variable.readAttribute(null, AttributeIds.UserAccessLevel);
        dataValue1.value.value.should.eql(0x3F);

    });
    it("should adjust userAccessLevel based on session Context permission", function () {

        variable.userAccessLevel = 0;
        variable.userAccessLevel.should.eql(0);

        variable.setPermissions({
            CurrentRead: ["*"],
            CurrentWrite: ["!*"]
        });
        const dataValue1 = variable.readAttribute(null, AttributeIds.UserAccessLevel);
        dataValue1.value.value.should.eql(0x0);

    });
    it("should adjust userAccessLevel based on session Context permission", function () {

        const context = new SessionContext({
            session: {},
        });
        context.getCurrentUserRole =  () => "Operator";

        variable.userAccessLevel = 0;
        variable.userAccessLevel.should.eql(0);

        variable.setPermissions({
            CurrentRead: ["*"],
            CurrentWrite: ["!*" , "Administrator"]
        });
        const dataValue1 = variable.readAttribute(context, AttributeIds.UserAccessLevel);
        dataValue1.value.value.should.eql(AccessLevelFlag.CurrentRead);

        context.getCurrentUserRole =  () => "Administrator";
        const dataValue2 = variable.readAttribute(context, AttributeIds.UserAccessLevel);
        dataValue2.value.value.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);

    });
});
