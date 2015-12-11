require("requirish")._(module);

var address_space = require("lib/address_space/address_space");
var AddressSpace = address_space.AddressSpace;
var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;
var should = require("should");
var path = require("path");



exports.get_mini_address_space = function (callback) {
    var mini_address_space = null;
    if (mini_address_space) {
        return callback(null, mini_address_space);
    }
    mini_address_space = new AddressSpace();
    var util = require("util");
    var nodeset_filename = path.join(__dirname ,"../../lib/server/mini.Node.Set2.xml");
    generate_address_space(mini_address_space, nodeset_filename, function () {
        callback(null, mini_address_space);
    });

};
