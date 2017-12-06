"use strict";
var path = require("path");
var fs = require("fs");

function constructNodesetFilename (filename) {

    var dirname = __dirname;
    var file = path.join(dirname,"nodesets", filename);
    if (!fs.existsSync(file)) {
        // let's find alternate places where to find the nodeset folder
        var appfolder = path.dirname(process.argv[1]);
        file = path.join(appfolder, "nodesets", filename);
        if (!fs.existsSync(file)) {
            appfolder = process.cwd();
            file = path.join(appfolder, "nodesets", filename);
        }
    }
    return file;
}

//{{ --------------------------------------------------------------
//   this block is use to force pkg to import nodesets in package
path.join(__dirname, "nodesets/Opc.Ua.NodeSet2.xml");
path.join(__dirname, "nodesets/Opc.Ua.Di.NodeSet2.xml");
path.join(__dirname, "nodesets/Opc.Ua.Adi.NodeSet2.xml");
//------------------------------------------------------------- }}
module.exports = {
    constructNodesetFilename:constructNodesetFilename,
    standard_nodeset_file: constructNodesetFilename("Opc.Ua.NodeSet2.xml"),
    di_nodeset_filename: constructNodesetFilename("Opc.Ua.Di.NodeSet2.xml"),
    adi_nodeset_filename: constructNodesetFilename("Opc.Ua.Adi.NodeSet2.xml")
};
