const assert = require("node-opcua-assert").assert;


/**
 * @method makeOptionalsMap
 * @param optionals
 * transform  optional into a map
 */

function makeOptionalsMap(optionals){


    const map = {};
    if (!optionals) {
        return map;
    }
    assert(optionals instanceof Array);

    function insertInMap(map,s){
        const key = s[0];

        if(!map[key]) {
            map[key] = {};
        }
        if (s.length>1) {
            insertInMap(map[key],s.splice(1));
        }

    }
    for(let i =0 ; i<  optionals.length; i++) {

        const opt = optionals[i];

        const s = opt.split(".");

        insertInMap(map,s);

    }
    return map;
}

exports.makeOptionalsMap = makeOptionalsMap;
