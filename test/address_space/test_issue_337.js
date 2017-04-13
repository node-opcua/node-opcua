


var opcua = require("../../");"use strict";
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

var SessionContext = require("lib/server/session_context").SessionContext;
var context = SessionContext.defaultContext;


describe("Testing bug found in #337",function() {

    var addressSpace = null;
    require("test/helpers/resource_leak_detector").installResourceLeakDetector(true,function() {
        before(function (done) {
            get_mini_address_space(function (err, data) {
                addressSpace = data;
                done(err);
            });
        });
        after(function () {
            if (addressSpace) {
                addressSpace.dispose();
            }
        });
    });

    it("should handle Matrix ",function() {

        var n =  addressSpace.addVariable({
            organizedBy: addressSpace.rootFolder.objects,
            nodeId: "ns=1;s=Position",
            browseName: "position",
            dataType: "Double",
            valueRank: 2,
            arrayDimensions: [3, 3],
            value: {
                get: function(){
                    return new opcua.Variant({
                        dataType: opcua.DataType.Double,
                        arrayType: opcua.VariantArrayType.Matrix,
                        dimensions: [3, 3],
                        value: [1, 2, 3, 4, 5, 6, 7, 8, 9]
                    });
                }
            }
        });

        n.readValue(null,new opcua.NumericRange());
    });

});
