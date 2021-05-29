
const { assert } = require("node-opcua-assert");
const { StatusCodes, AttributeIds, makeAccessLevelFlag }= require("node-opcua");

//  Description: Write to a node whose AccessLevel does not contain write capabilities.


//function read_access_level(session,nodeId,callback) {
//
//    var nodesToRead = [];
//    nodesToRead.push({
//        nodeId: nodeId,
//        attributeId: AttributeIds.AccessLevel,
//        indexRange: null,
//        dataEncoding: null
//    });
//    session.read(nodesToRead, function (err, dataValues) {
//        // inspect(dataValues);
//        // expected_value = dataValues[0].value.value[indexToFind];
//        callback(err,dataValues);
//    });
//}

function check_expecting_no_error_and_one_datavalue_with_statusGood(err,dataValues,extra_message , callback) {

    if (!err) {
        if (dataValues.length !== 1) {
            err = new Error(" Expecting 1 value in dataValues but got " + dataValues.length + " instead " + extra_message);
        } else {
            if (dataValues[0].statusCode.isNot(StatusCodes.Good)) {
                err = new Error(" Expecting statusCode to be Good but  " + dataValues[0].statusCode.toString() + " instead "+ extra_message);
            }
        }
    }
    callback(err,dataValues);
}
function check_statusCodes_are_expected(err,statusCodes/*: StatusCode[]*/,expectedStatusCodes,extra_message,callback) {
    if (!err) {

        for(const statusCode of statusCodes) {

            const found = (expectedStatusCodes.indexOf(statusCodes) !== -1);
            if (found) {
                err = new Error(" Expecting statusCode  " + statusCode.toString() + " to be one of  "+ expectedStatusCodes.toString() );
                break;
            }

        }

    }
    callback(err, statusCodes);
}

function read_attribute(session,nodeId,attributeId,callback) {

    const nodesToRead = [];
    nodesToRead.push({
        nodeId: nodeId,
        attributeId:attributeId,
        indexRange: null,
        dataEncoding: null
    });
    session.read(nodesToRead, function (err, dataValues) {

        check_expecting_no_error_and_one_datavalue_with_statusGood(err, dataValues," while reading " + nodeId.toString(),function(err,dataValues){

            callback(err,dataValues[0]);
        });
        // inspect(dataValues);
        // expected_value = dataValues[0].value.value[indexToFind];
    });
}

function read_value(session,nodeId,callback) {
    read_attribute(session,nodeId,AttributeIds.Value,function (err,dataValue) {

        let variant = null;
        if(!err) {
            variant = dataValue.value;
        }
        callback(err,variant);
    });

}

function _read_access_level(session,nodeId,attributeId,callback) {
    assert(AttributeIds.AccessLevel === attributeId || AttributeIds.UserAccessLevel === attributeId," invalid attribute");

    read_attribute(session,nodeId,attributeId,function (err,dataValue){
        let accessLevel = null;
        if (!err) {
            accessLevel = makeAccessLevelFlag(dataValue.value.value);
        }
        callback(err,accessLevel);
    });
}

function read_user_access_level(session,nodeId,callback) {
    _read_access_level(session,nodeId,AttributeIds.UserAccessLevel,callback);
}
function read_access_level(session,nodeId,callback) {
    _read_access_level(session,nodeId,AttributeIds.AccessLevel,callback);
}

function _write_node_value(session,nodeId,value,attributeId,expectedStatusCodes,callback) {


    const nodesToWrite = [];
    nodesToWrite.push({
        nodeId: nodeId,
        attributeId:attributeId,
        indexRange: null,
        value: { // DataValue
            value: value
        }
    });
    session.write(nodesToWrite, function (err, statusCodes) {

        check_statusCodes_are_expected(err,statusCodes,expectedStatusCodes," while writing " + nodeId.toString() + " and attribute : " + attributeId,function(err,statusCodes){
            callback(err,statusCodes[0]);
        });
        // inspect(dataValues);
        // expected_value = dataValues[0].value.value[indexToFind];
    });
}
function write_node_value(session,nodeId,value,expectedStatusCodes,callback) {
    _write_node_value(session,nodeId,value,AttributeIds.Value,expectedStatusCodes,callback);
}


exports.register_test = function (options) {

    const item = nodeIdSettings.securityAccess.accessLevelCurrentReadNotCurrentWrite;

    describe_on_session("\n    AddressSpace User Write Access : ",options,function() {

        if (!item) {
            xit(" No READ ONLY Node defined, please check nodeIdSettings in helpers.js",function(){});
            return;
        }

        it("001 :  Write to a node whose AccessLevel does not contain write capabilities.",function(done){

            // read the node (actually read the 'accesslevel' and 'value' attributes (saves a 2nd read later)
            read_access_level(options.session,item,function(err,accessLevel){

                if (accessLevel  & AccessLevelFlag.CurrentWrite ) {

                    err =new Error(" cannot perform test because node " + item.toString() + " is readonly "+
                                   "(accessLevelFlag ="  + accessLevel.toString() + "). we need something that is Writable at the global level"
                    );

                    done(err);

                } else {

                    read_value(options.session,item,function(err,originalValue) {
                        if (err) {return done(err); }

                        read_user_access_level(options.session,item,function(err,accessLevel) {
                            if ( accessLevel  & AccessLevelFlag.CurrentWrite) {
                                err =new Error(" the UserAccessLevel of " +  item.toString() + " shows as " + accessLevel.toString() + ". "+
                                        "\nWe need something read only at the user level to be able to perform the test"
                                );
                                done(err);
                            } else {

                                var expectedStatusCodes = [ StatusCodes.BadNotWritable, StatusCodes.BadUserAccessDenied ];

                                // try to write some value : ( we expect the attempt to fail )
                                write_node_value(options.session,item,originalValue,expectedStatusCodes,function(err) {
                                    done(err);
                                });
                            }
                        });

                    })
                }
            })
        });
    });
};


/*
var expectedResult = new ExpectedAndAcceptedResults( StatusCodes.Good );
item.AttributeId = Attribute.AccessLevel;
if( !ReadHelper.Execute( {
    NodesToRead: item,
    TimestampsToReturn: TimestampsToReturn.Server,
    OperationResults: [ expectedResult ],
} ) ) {
    addError( "Aborting test, initial reading of the 'WriteMask' attribute failed." );
    return;
}

// is this node configured correctly, can we use it?
if( ( ReadHelper.Response.Results[0].Value & AccessLevel.CurrentWrite ) === AccessLevel.CurrentWrite ) {
    item.AttributeId = Attribute.UserAccessLevel;
    if( ReadHelper.Execute( { NodesToRead: item } ) ) {
        if( ( ReadHelper.Response.Results[0].Value & AccessLevel.CurrentWrite ) === AccessLevel.CurrentWrite ) {
            addError( "The UserAccessLevel shows as '" + ReadHelper.Response.Results[0].Value.toString() + "'. We need something that can be read, but cannot be written to. Check setting '" + ROSETTING + "'." );
            return;
        }
    }
    else {
        addError( "The AccessLevel shows as '" + ReadHelper.Response.Results[0].Value.toString() + "'. We need something that can be read, but cannot be written to. Check setting '" + ROSETTING + "'." );
        return;
    }
}
print( "AccessLevel = " + ReadHelper.Response.Results[0].Value + " (vs. CurrentWrite=" + AccessLevel.CurrentWrite + ")" );

// if we reach this far then we have a node that we can test.
// setup our expected errors
expectedResult = new ExpectedAndAcceptedResults( [ StatusCodes.BadNotWritable, StatusCodes.BadUserAccessDenied ] );

// just write back the same value we received.
WriteHelper.Execute( {
    NodesToWrite: item,
    OperationResults: expectedResult,
    ReadVerification: false
} );

// clean-up
item = null;
*/