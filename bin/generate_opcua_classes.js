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
require("requirish")._(module);

var argv = require('yargs')
    .strict()
    .usage('Usage: $0 --clear --verbose ')
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
            var filePath = dirPath + '/' + files[i];
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
    require("lib/misc/factories").verbose = true;
}

// make sure ExtensionObject is defined
require("lib/misc/extension_object");

var registerObject = require("lib/misc/factories").registerObject;

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

registerObject("lib/data_access/schemas|Range");
registerObject("lib/data_access/schemas|EUInformation");
registerObject("lib/data_access/schemas|AxisInformation");
//xxregisterObject("lib/data_access/schemas|ComplexNumber");
//xxregisterObject("lib/data_access/schemas|DoubleComplexNumber");
//xxregisterObject("lib/data_access/schemas|XVType");


registerObject("ReadValueId");
registerObject("ReadRequest");
registerObject("ReadResponse");

registerObject("EnumValueType");

// subscription service
//xx registerObject("MonitoringMode");
registerObject("CreateSubscriptionRequest");
registerObject("CreateSubscriptionResponse");
registerObject("ModifySubscriptionRequest");
registerObject("ModifySubscriptionResponse");
registerObject("MonitoringParameters");
registerObject("MonitoredItemCreateRequest");
registerObject("MonitoredItemCreateResult");
registerObject("CreateMonitoredItemsRequest");
registerObject("CreateMonitoredItemsResponse");
registerObject("SubscriptionAcknowledgement");
registerObject("PublishRequest");
registerObject("NotificationMessage");
registerObject("PublishResponse");
registerObject("RepublishRequest");
registerObject("RepublishResponse");
registerObject("DeleteMonitoredItemsRequest");
registerObject("DeleteMonitoredItemsResponse");
registerObject("SetPublishingModeRequest");
registerObject("SetPublishingModeResponse");
registerObject("DeleteSubscriptionsRequest");
registerObject("DeleteSubscriptionsResponse");
registerObject("MonitoredItemNotification");
registerObject("DataChangeNotification");
registerObject("DataChangeFilter");
registerObject("MonitoredItemModifyRequest");
registerObject("MonitoredItemModifyResult");
registerObject("ModifyMonitoredItemsRequest");
registerObject("ModifyMonitoredItemsResponse");
registerObject("SetMonitoringModeRequest");
registerObject("SetMonitoringModeResponse");
registerObject("EventFieldList");
registerObject("EventNotificationList");
registerObject("StatusChangeNotification");
registerObject("SetTriggeringRequest");
registerObject("SetTriggeringResponse");
registerObject("TransferResult");
registerObject("TransferSubscriptionsRequest");
registerObject("TransferSubscriptionsResponse");


// secure_channel_service
registerObject("AsymmetricAlgorithmSecurityHeader");
registerObject("SymmetricAlgorithmSecurityHeader");
registerObject("SequenceHeader");

// Historizing service
registerObject("AggregateConfiguration");
registerObject("HistoryReadValueId");
registerObject("HistoryReadRequest");
registerObject("HistoryReadResult");
registerObject("HistoryReadResponse");
registerObject("HistoryReadDetails");
registerObject("MonitoringFilter");
// history
registerObject("ModificationInfo");
registerObject("HistoryData");
registerObject("HistoryModifiedData");

registerObject("HistoryUpdateResult");
registerObject("HistoryUpdateRequest");
registerObject("HistoryUpdateResponse");

// translate_browse_path_to_node_is
registerObject("RelativePathElement");
registerObject("RelativePath");
registerObject("BrowsePath");
registerObject("TranslateBrowsePathsToNodeIdsRequest");
registerObject("BrowsePathTarget");
registerObject("BrowsePathResult");
registerObject("TranslateBrowsePathsToNodeIdsResponse");

registerObject("RegisterNodesResponse");
registerObject("RegisterNodesRequest");
registerObject("UnregisterNodesResponse");
registerObject("UnregisterNodesRequest");

// BaseDataType
registerObject("Argument");
//xx registerObject("BaseDataType");

// write
registerObject("WriteValue");
registerObject("WriteRequest");
registerObject("WriteResponse");
// ContentFilter
registerObject("FilterOperand");

registerObject("SimpleAttributeOperand");
registerObject("ElementOperand");
registerObject("LiteralOperand");
registerObject("AttributeOperand");
registerObject("ContentFilterElement");
registerObject("ContentFilter");

registerObject("EventFilter");
registerObject("ReadEventDetails");
registerObject("ReadRawModifiedDetails");
registerObject("ReadProcessedDetails");
registerObject("ReadAtTimeDetails");

// Event results
registerObject("ContentFilterElementResult");
registerObject("ContentFilterResult");
registerObject("EventFilterResult");

// Call service
registerObject("CallMethodRequest");
registerObject("CallMethodResult");
registerObject("CallRequest");
registerObject("CallResponse");


// Register Server Service

registerObject("RegisteredServer");
registerObject("RegisterServerRequest");
registerObject("RegisterServerResponse");

registerObject("FindServersRequest");
registerObject("FindServersResponse");



// node Management service
registerObject("AddNodesItem");
registerObject("AddNodesRequest");

registerObject("AddNodesResult");
registerObject("AddNodesResponse");

registerObject("AddReferencesItem");
registerObject("AddReferencesRequest");
registerObject("AddReferencesResponse");

registerObject("DeleteNodesItem");
registerObject("DeleteNodesRequest");
registerObject("DeleteNodesResponse");

registerObject("DeleteReferencesItem");
registerObject("DeleteReferencesRequest");
registerObject("DeleteReferencesResponse");

// query service
// -- already registerObject("ContentFilterResult");
registerObject("ParsingResult");
registerObject("QueryDataDescription");
registerObject("NodeTypeDescription");
registerObject("QueryFirstRequest");
registerObject("QueryDataSet");
registerObject("QueryFirstResponse");


registerObject("QueryNextRequest");
registerObject("QueryNextResponse");


// -------------------------------------------------------------------------
var filename = path.join(__dirname, "../nodesets/Opc.Ua.NodeSet2.xml");

var address_space = require("lib/address_space/address_space");
var AddressSpace = address_space.AddressSpace;

var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;

var createExtensionObjectDefinition = require("lib/address_space/convert_nodeset_to_types").createExtensionObjectDefinition;


var addressSpace = new AddressSpace();

generate_address_space(addressSpace, filename, function () {

    createExtensionObjectDefinition(addressSpace);

    console.log("done");

});



