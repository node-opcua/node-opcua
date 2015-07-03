var path = "../../../";
var opcua = require(path);
var makeNodeId = opcua.makeNodeId;
var DataValue = opcua.DataValue;
var DataType = opcua.DataType;
var AttributeIds = opcua.AttributeIds;
var NumericRange = opcua.NumericRange;
var OPCUAClient = opcua.OPCUAClient;
var StatusCodes = opcua.StatusCodes;

var should = require("should");

var ns = 411;




var inspect = require('eyes').inspector(); // {styles: {all: 'magenta'}});
var async = require("async");

// 1. Read the raw array value.
// 2. Read the array value specifying the IndexRange.
// 3. Compare the value of the 2nd read matches element #2 of the first read.
// 4. REPEAT FOR EACH DATA TYPE.

function read_allvalues(session,nodeId,callback) {

    var nodesToRead = [];
    nodesToRead.push({
        nodeId: nodeId,
        attributeId: AttributeIds.Value,
        indexRange: null,
        dataEncoding: null
    });
    session.read(nodesToRead, function (err, unused, dataValues) {
        // inspect(dataValues);
        // expected_value = dataValues[0].value.value[indexToFind];
        callback(err,dataValues);

    });
}

function verify_ReadRequest(request,response,callback) {

}

function read_range_value(session,nodeId,indexToFind,callback) {
    var nodesToRead = [];
    nodesToRead.push({
        nodeId: nodeId,
        attributeId: AttributeIds.Value,
        indexRange: new NumericRange(indexToFind),
        dataEncoding: null
    });
    session.read(nodesToRead, function (err, unused, dataValues) {
        callback(err,dataValues);
    });
}
function test_24_on_node(session,nodeId,callback) {

    var indexToFind = 2 ;
    read_allvalues(session,nodeId,function(err,dataValues){

        if (!err) {
            if (dataValues.length !==1) {
                callback(new Error("Expecting one value in dataValues"));
                return;
            }
            if (dataValues[0].statusCode !== StatusCodes.Good) {
                callback(new Error("dataValues[0] : Expecting status code Good  got " + dataValues[0].statusCode.toString() + " instead while reading " + nodeId.toString() ));
                return;
            }

            var expected_value = dataValues[0].value.value[indexToFind];
            read_range_value(session,nodeId,indexToFind,function(err,dataValues){

                try {
                    // inspect(dataValues);
                    dataValues.length.should.eql(1);
                    dataValues[0].statusCode.should.eql(StatusCodes.Good);
                    dataValues[0].value.value.should.be.instanceOf(Array);
                    dataValues[0].value.value.length.should.equal(1);
                    dataValues[0].value.value[0].should.eql(expected_value);
                } catch(test_err) {
                    console.log(" Cauch ",test_err.message);
                    err = test_err;
                }

                callback(err);

            });
        } else {
            console.log("err = ".yellow,err);
            // cannot read array
            callback(err);
        }
    });
}


/**
 *
 * @param title
 * @param callback {Funtion}
 * @param callback.options.session {ClientSession}
 */

exports.register_test = function (options) {


    describe_on_session("\n    24 : Read: Arrays, read one node of each data type specifying an IndexRange retrieving 2nd element only.",options,function(){

        nodeIdSettings.arraysStatic.forEach(function (nodeId) {
            it("should read one node on a " + nodeId.toString(),function(done){
                test_24_on_node(options.session,nodeId,done);
            })
        });

    });

};


