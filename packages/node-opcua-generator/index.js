
exports.registerObject = require("./src/generator").registerObject;
exports.unregisterObject = require("./src/generator").unregisterObject;

exports.encode_decode_round_trip_test =  require("./test_helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;
exports.json_encode_decode_round_trip_test =  require("./test_helpers/encode_decode_round_trip_test").json_encode_decode_round_trip_test;