"use strict";
/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");
var Method = require("lib/address_space/ua_method").Method;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;
var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var _ = require("underscore");
var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var assert = require("better-assert");

var Enum = require("lib/misc/enum");


require("lib/address_space/address_space_add_enumeration_type");

describe("AddressSpace : testing add enumeration ", function () {

    var address_space;
    before(function (done) {
        address_space = new AddressSpace();

        var xml_file = __dirname + "/../../lib/server/mini.Node.Set2.xml";
        require("fs").existsSync(xml_file).should.be.eql(true);

        generate_address_space(address_space, xml_file, function (err) {
            done(err);
        });

    });


    function convert(enumDescription) {
        return enumDescription.enums.map(function(enumItem){
            return {
                name: enumItem.key,
                value: enumItem.value
            };
        });
    }
    it("should add a new Enumeration type into an address space",function() {

        var myEnumType = address_space.addEnumerationType({
            browseName:"MyEnumType",
            enumeration: convert(new Enum(["RUNNING","BLOCKED"]))

        });

        myEnumType.browseName.should.eql("MyEnumType");

    });

});
