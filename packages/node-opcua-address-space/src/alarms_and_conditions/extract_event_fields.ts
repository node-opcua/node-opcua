import { IEventData, ISessionContext, UAObject } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { AttributeIds } from "node-opcua-data-model";
import { resolveNodeId } from "node-opcua-nodeid";
import { SimpleAttributeOperand } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";

function assert_valid_event_data(eventData: IEventData) {
    assert(typeof eventData.resolveSelectClause === "function");
    assert(typeof eventData.readValue === "function");
}

/**
 *
 * @method extractEventField
 * extract a eventField from a event node, matching the given selectClause
 * @param eventData
 * @param selectClause
 */
function extractEventField(sessionContext: ISessionContext, eventData: IEventData, selectClause: SimpleAttributeOperand): Variant {
    assert_valid_event_data(eventData);
    assert(selectClause instanceof SimpleAttributeOperand);

    selectClause.browsePath = selectClause.browsePath || [];

    if (selectClause.browsePath.length === 0 && selectClause.attributeId === AttributeIds.NodeId) {
        const eventSource = eventData.$eventDataSource as UAObject;
        const addressSpace = eventSource.addressSpace;
        const conditionTypeNodeId = resolveNodeId("ConditionType");
        const conditionType = addressSpace.findObjectType(conditionTypeNodeId);

        /* istanbul ignore next */
        if (!conditionType) {
            throw new Error("Cannot find ConditionType NodeId  !");
        }

        // "ns=0;i=2782" => ConditionType
        // "ns=0;i=2041" => BaseEventType
        if (selectClause.typeDefinitionId.toString() !== "ns=0;i=2782") {
            // not a ConditionType
            // but could be on of its derived type. for instance ns=0;i=2881 => AcknowledgeableConditionType
            const typeDefinitionObj = addressSpace.findObjectType(selectClause.typeDefinitionId);

            /* istanbul ignore next */
            if (!typeDefinitionObj) {
                throw new Error("Cannot find TypeDefinition Type !");
            }
            if (!typeDefinitionObj.isSupertypeOf(conditionType)) {
                // tslint:disable-next-line:no-console
                console.warn(" ", typeDefinitionObj ? typeDefinitionObj.browseName.toString() : "????");
                // tslint:disable-next-line:no-console
                console.warn(
                    "this case is not handled yet : selectClause.typeDefinitionId = " + selectClause.typeDefinitionId.toString()
                );
                const eventSource1 = eventData.$eventDataSource!;
                return new Variant({ dataType: DataType.NodeId, value: eventSource1.nodeId });
            }
        }

        const eventSourceTypeDefinition = eventSource.typeDefinitionObj;
        if (!eventSourceTypeDefinition) {
            // eventSource is a EventType class
            return new Variant();
        }

        if (!eventSourceTypeDefinition.isSupertypeOf(conditionType)) {
            return new Variant();
        }
        // Yeh : our EventType is a Condition Type !
        return new Variant({ dataType: DataType.NodeId, value: eventSource.nodeId });
    }

    const handle = eventData.resolveSelectClause(selectClause);

    if (handle !== null) {
        const value = eventData.readValue(sessionContext, handle, selectClause);
        assert(value instanceof Variant);
        return value;
    } else {
        // Part 4 - 7.17.3
        // A null value is returned in the corresponding event field in the Publish response if the selected
        // field is not part of the Event or an error was returned in the selectClauseResults of the EventFilterResult.
        // return new Variant({dataType: DataType.StatusCode, value: browsePathResult.statusCode});
        return new Variant();
    }
}

/**
 * @method extractEventFields
 * extract a array of eventFields from a event node, matching the selectClauses
 * @param selectClauses
 * @param eventData : a pseudo Node that provides a browse Method and a readValue(nodeId)
 */
export function extractEventFields(
    sessionContext: ISessionContext,
    selectClauses: SimpleAttributeOperand[],
    eventData: IEventData
): Variant[] {
    assert_valid_event_data(eventData);
    assert(Array.isArray(selectClauses));
    assert(selectClauses.length === 0 || selectClauses[0] instanceof SimpleAttributeOperand);
    return selectClauses.map(extractEventField.bind(null, sessionContext, eventData));
}
