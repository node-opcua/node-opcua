"use strict";
// ---------------------------------------------------------------------------------------------------------------------
// node-opcua
// ---------------------------------------------------------------------------------------------------------------------
// Copyright (c) 2014-2016 - Etienne Rossignon - etienne.rossignon (at) gadz.org
// ---------------------------------------------------------------------------------------------------------------------
//
// This  project is licensed under the terms of the MIT license.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
// documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so,  subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
// Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
// WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
// COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
// ---------------------------------------------------------------------------------------------------------------------


var argv = require("yargs")
    .strict()
    .usage("Usage: $0 --clear --verbose ")
    .options({
        clear: {
            type: "boolean",
            describe: "delete existing _generated_ files first"
        },
        verbose: {
            type: "boolean",
            describe: "display extra info"
        }
    }).help("help")
    .argv;

var path = require("path");
var fs = require("fs");

function remove_files_in_folder(dirPath, removeSelf) {

    if (argv.verbose) {
        console.log(" removing files in ", dirPath);
    }

    if (removeSelf === undefined) {
        removeSelf = true;
    }
    var files;
    try {
        files = fs.readdirSync(dirPath);
    }
    catch (e) {
        return;
    }
    if (files.length > 0) {
        for (var i = 0; i < files.length; i++) {
            var filePath = path.join(dirPath ,files[i]);
            if (fs.statSync(filePath).isFile()) {

                if (argv.verbose) {
                    console.log(" .... deleting  ", filePath);
                }
                fs.unlinkSync(filePath);
            } else {
                remove_files_in_folder(filePath);
            }

        }
    }
    if (removeSelf) {
        fs.rmdirSync(dirPath);
    }
}

Error.stackTraceLimit = Infinity;
//
// options :
//   --clear : delete all files in _generated_ folder first
//   --verbose:
if (argv.clear) {
    remove_files_in_folder(path.normalize(path.join(__dirname, "../_generated_")), false);
}
if (argv.verbose) {
    require("node-opcua-factory").verbose = true;
}

// make sure ExtensionObject is defined
require("node-opcua-extension-object");

var registerObject = require("node-opcua-factory").registerObject;

registerObject("TCPErrorMessage");

registerObject("QualifiedName");
registerObject("LocalizedText");
registerObject("DiagnosticInfo");
registerObject("RequestHeader");
registerObject("ResponseHeader");
registerObject("AcknowledgeMessage");
registerObject("HelloMessage");
registerObject("ErrorMessage");
registerObject("Variant");
registerObject("BuildInfo");


// browse service
registerObject("ViewDescription");
// browse direction
registerObject("ReferenceDescription");
registerObject("BrowseResult");
registerObject("BrowseDescription");
registerObject("BrowseRequest");
registerObject("BrowseResponse");

registerObject("BrowseNextRequest");
registerObject("BrowseNextResponse");

///
registerObject("ApplicationDescription");
registerObject("UserTokenPolicy");

registerObject("EndpointDescription");
registerObject("GetEndpointsRequest");
registerObject("GetEndpointsResponse");

registerObject("OpenSecureChannelRequest");
registerObject("ChannelSecurityToken");
registerObject("OpenSecureChannelResponse");

registerObject("CloseSecureChannelRequest");
registerObject("CloseSecureChannelResponse");
registerObject("ServiceFault");
registerObject("SignedSoftwareCertificate");
registerObject("SignatureData");

registerObject("CreateSessionRequest");
registerObject("CreateSessionResponse");

registerObject("ActivateSessionRequest");
registerObject("ActivateSessionResponse");

registerObject("CloseSessionRequest");
registerObject("CloseSessionResponse");

registerObject("CancelRequest");
registerObject("CancelResponse");

registerObject("AnonymousIdentityToken");
registerObject("UserNameIdentityToken");
registerObject("X509IdentityToken");
registerObject("IssuedIdentityToken");

registerObject("DataValue");

registerObject("$node-opcua/data_access/schemas|Range");
registerObject("$node-opcua/data_access/schemas|EUInformation");
registerObject("$node-opcua/data_access/schemas|AxisInformation");
//xxregisterObject("lib/data_access/schemas|ComplexNumber");
//xxregisterObject("lib/data_access/schemas|DoubleComplexNumber");
//xxregisterObject("lib/data_access/schemas|XVType");


registerObject("ReadValueId");
registerObject("ReadRequest");
registerObject("ReadResponse");

registerObject("EnumValueType");




// secure_channel_service
registerObject("AsymmetricAlgorithmSecurityHeader");
registerObject("SymmetricAlgorithmSecurityHeader");
registerObject("SequenceHeader");




registerObject("RegisterNodesResponse");
registerObject("RegisterNodesRequest");
registerObject("UnregisterNodesResponse");
registerObject("UnregisterNodesRequest");







// -------------------------------------------------------------------------
var filename = path.join(__dirname, "../../nodesets/Opc.Ua.NodeSet2.xml");

var address_space = require("node-opcua-address-space");
var AddressSpace = address_space.AddressSpace;

var generate_address_space = require("node-opcua-address-space-loader").generate_address_space;

var createExtensionObjectDefinition = require("node-opcua-address-space").createExtensionObjectDefinition;


var addressSpace = new AddressSpace();

generate_address_space(addressSpace, filename, function () {

    createExtensionObjectDefinition(addressSpace);

    console.log("done");

});



