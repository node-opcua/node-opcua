var assert = require("better-assert");


/**
 *
 * transform  optional into a map
 */

function makeOptionalsMap(optionals){


    var map = {};
    if (!optionals) {
        return map;
    }
    assert(optionals instanceof Array);

    function insertInMap(map,s){
        var key = s[0];

        if(!map[key]) {
            map[key] = {};
        }
        if (s.length>1) {
            insertInMap(map[key],s.splice(1));
        }

    }
    for(var i =0 ; i<  optionals.length; i++) {

        var opt = optionals[i];

        var s = opt.split(".");

        insertInMap(map,s);

    }
    return map;
}

exports.makeOptionalsMap = makeOptionalsMap;