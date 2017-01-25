/**
 * @module opcua.address_space.AlarmsAndConditions
 */

import { EventEmitter } from "events";
import util from "util";
import assert from "better-assert";
import _ from "underscore";
import UAVariable from "lib/address_space/UAVariable";
import { Variant } from "lib/datamodel/variant";
import { DataType } from "lib/datamodel/variant";
import { StatusCodes } from "lib/datamodel/opcua_status_code";
import { StatusCode } from "lib/datamodel/opcua_status_code";
import { UAObjectType } from "lib/address_space/ua_object_type";
import { UAObject } from "lib/address_space/ua_object";
import { BaseNode } from "lib/address_space/base_node";
import { AttributeIds } from "lib/datamodel/attributeIds";
import { NodeClass } from "lib/datamodel/nodeclass";
import { resolveNodeId } from "lib/datamodel/nodeid";
import { coerceLocalizedText } from "lib/datamodel/localized_text";
import { LocalizedText } from "lib/datamodel/localized_text";
import { NodeId } from "lib/datamodel/nodeid";
import EventData from "lib/address_space/add-event-type/EventData";
import { BrowseDirection } from "lib/services/browse_service";

import AddressSpace from "lib/address_space/AddressSpace";
import {
  make_debugLog,
  checkDebugFlag,
  lowerFirstLetter
} from "lib/misc/utils";
import * as ec from "lib/misc/encode_decode";
import { makeNodeId } from "lib/datamodel/nodeid";
import { makeAccessLevel } from "lib/datamodel/access_level";


require("set-prototype-of");

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);



/**
 * @class ConditionInfo
 * @param options  {Object}
 * @param options.message   {String|LocalizedText} the event message
 * @param options.severity  {UInt16} severity
 * @param options.quality   {StatusCode} quality
 * @param options.retain   {Boolean} retain flag
 * @constructor
 */
class ConditionInfo {
  constructor(options) {
    this.severity = null;
    this.quality  = null;
    this.message  = null;
    this.retain   = null;

    if (options.hasOwnProperty("message") && options.message != null) {
      options.message = LocalizedText.coerce(options.message);
      assert(options.message instanceof LocalizedText);
      this.message  = options.message;
    }
    if (options.hasOwnProperty("quality")  && options.quality != null) {
      this.quality  = options.quality;
    }
    if (options.hasOwnProperty("severity")  && options.severity != null) {
      assert(_.isNumber(options.severity));
      this.severity  = options.severity;
    }
    if (options.hasOwnProperty("retain")  && options.retain != null) {
      assert(_.isBoolean(options.retain));
      this.retain  = options.retain;
    }
  }

  /**
   * @method isDifferentFrom
   * @param otherConditionInfo {ConditionInfo}
   * @return {Boolean}
   */
  isDifferentFrom(otherConditionInfo) {
    return this.severity != otherConditionInfo.severity  ||
          this.quality  != otherConditionInfo.quality ||
          this.message  != otherConditionInfo.message;
  }
}




function _perform_condition_refresh(addressSpace, inputArguments, context) {
    // --- possible StatusCodes:
    //
    // Bad_SubscriptionIdInvalid  See Part 4 for the description of this result code
    // Bad_RefreshInProgress      See Table 74 for the description of this result code
    // Bad_UserAccessDenied       The Method was not called in the context of the Session
    //                            that owns the Subscription
    //

    // istanbul ignore next
  if (addressSpace._condition_refresh_in_progress) {
        // a refresh operation is already in progress....
    return StatusCodes.BadRefreshInProgress;
  }

  addressSpace._condition_refresh_in_progress = true;

  const server = context.object.addressSpace.rootFolder.objects.server;
  assert(server instanceof UAObject);

  const refreshStartEventType = addressSpace.findEventType("RefreshStartEventType");
  const refreshEndEventType = addressSpace.findEventType("RefreshEndEventType");

  assert(refreshStartEventType instanceof UAObjectType);
  assert(refreshEndEventType instanceof UAObjectType);

  server.raiseEvent(refreshStartEventType, {});
    // todo : resend retained conditions

    // starting from server object ..
    // evaluated all --> hasNotifier/hasEventSource -> node
  server._conditionRefresh();

  server.raiseEvent(refreshEndEventType, {});

  addressSpace._condition_refresh_in_progress = false;

  return StatusCodes.Good;
}


export default ConditionInfo;
