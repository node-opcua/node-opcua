/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
require("set-prototype-of");
import { assert } from "node-opcua-assert";
import { LocalizedText, LocalizedTextLike } from "node-opcua-data-model";
import { minDate } from "node-opcua-basic-types";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { ConditionSnapshotImpl } from "./condition_snapshot_impl";

export function _setAckedState(
    self: ConditionSnapshotImpl,
    requestedAckedState: boolean,
    conditionEventId?: Buffer,
    comment?: string | LocalizedText | LocalizedTextLike
): StatusCode {
    assert(self instanceof ConditionSnapshotImpl);

    const ackedState = self.getAckedState();

    if (ackedState && requestedAckedState) {
        return StatusCodes.BadConditionBranchAlreadyAcked;
    }
    self._set_twoStateVariable("ackedState", requestedAckedState);
    return StatusCodes.Good;
}

// tslint:disable:max-classes-per-file
function prepare_date(sourceTimestamp: { value: Date } | null) {
    if (!sourceTimestamp || !sourceTimestamp.value) {
        return minDate;
    }
    assert(sourceTimestamp.value instanceof Date);
    return sourceTimestamp;
}

/*
 As per spec OPCUA 1.03 part 9:

 A Condition’s EnabledState effects the generation of Event Notifications and as such results
 in the following specific behaviour:
 * When the Condition instance enters the Disabled state, the Retain Property of this
 Condition shall be set to FALSE by the Server to indicate to the Client that the
 Condition instance is currently not of interest to Clients.
 * When the Condition instance enters the enabled state, the Condition shall be
 evaluated and all of its Properties updated to reflect the current values. If this
 evaluation causes the Retain Property to transition to TRUE for any ConditionBranch,
 then an Event Notification shall be generated for that ConditionBranch.
 * The Server may choose to continue to test for a Condition instance while it is
 Disabled. However, no Event Notifications will be generated while the Condition
 instance is disabled.
 * For any Condition that exists in the Address Space the Attributes and the following
 Variables will continue to have valid values even in the Disabled state; EventId, Event
 Type, Source Node, Source Name, Time, and EnabledState.
 Other properties may no longer provide current valid values.
 All Variables that are no longer provided shall return a status of BadConditionDisabled.
 The Event that reports the Disabled state  should report the properties as NULL or with a status
 of BadConditionDisabled.
 When enabled, changes to the following components shall cause a ConditionType Event Notification:
 - Quality
 - Severity (inherited from BaseEventType)
 - Comment

 // spec :
 // The HasCondition ReferenceType is a concrete ReferenceType and can be used directly. It is
 // a subtype of NonHierarchicalReferences.
 // The semantic of this ReferenceType is to specify the relationship between a ConditionSource
 // and its Conditions. Each ConditionSource shall be the target of a HasEventSource Reference
 // or a sub type of HasEventSource. The Address Space organisation that shall be provided for
 // Clients to detect Conditions and ConditionSources is defined in Clause 6. Various examples
 // for the use of this ReferenceType can be found in B.2.
 // HasCondition References can be used in the Type definition of an Object or a Variable. In this
 // case, the SourceNode of this ReferenceType shall be an ObjectType or VariableType Node or
 // one of their InstanceDeclaration Nodes. The TargetNode shall be a Condition instance
 // declaration or a ConditionType. The following rules for instantiation apply:
 //  All HasCondition References used in a Type shall exist in instances of these Types as
 //    well.
 //  If the TargetNode in the Type definition is a ConditionType, the same TargetNode will
 //    be referenced on the instance.
 // HasCondition References may be used solely in the instance space when they are not
 // available in Type definitions. In this case the SourceNode of this ReferenceType shall be an
 // Object, Variable or Method Node. The TargetNode shall be a Condition instance or a
 // ConditionType.

 */
