"use strict";
var path = require("path");
var $_$ ={dirname:__dirname};

function constructNodesetFilename (filename) {
    var dirname = $_$.dirname;
    var file = path.join(dirname,"nodesets", filename);
    return file;
}

module.exports = {

    constructNodesetFilename:constructNodesetFilename,

    standard_nodeset_file: constructNodesetFilename("Opc.Ua.NodeSet2.xml"),
    di_nodeset_filename: constructNodesetFilename("Opc.Ua.Di.NodeSet2.xml"),
    adi_nodeset_filename: constructNodesetFilename("Opc.Ua.Adi.NodeSet2.xml"),
    part8_nodeset_filename: constructNodesetFilename("Opc.Ua.NodeSet2.Part8.xml")
};