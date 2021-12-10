/**
 * @module node-opcua-address-space
 */
import { assert } from "node-opcua-assert";
import { NodeClass } from "node-opcua-data-model";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue, DataValueLike } from "node-opcua-data-value";
import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import * as utils from "node-opcua-utils";
import { DataType } from "node-opcua-variant";
import {
    AddObjectOptions,
    InstantiateObjectOptions,
    ISessionContext,
    UAObject,
    UAObjectType,
    UAReference
} from "node-opcua-address-space-base";

import { SessionContext } from "../source/session_context";
import { BaseNodeImpl } from "./base_node_impl";
import { ToStringBuilder, UAObjectType_toString } from "./base_node_private";
import { get_subtypeOf, get_subtypeOfObj } from "./tool_isSupertypeOf";
import * as tools from "./tool_isSupertypeOf";
import {
    assertUnusedChildBrowseName,
    initialize_properties_and_components,
    topMostParentIsObjectTypeOrVariableType
} from "./ua_variable_type_impl";
import { AddressSpacePrivate } from "./address_space_private";

export class UAObjectTypeImpl extends BaseNodeImpl implements UAObjectType {
    public readonly nodeClass = NodeClass.ObjectType;
    public readonly isAbstract: boolean;
    /**
     * returns true if the object has some opcua methods
     */
    public get hasMethods(): boolean {
        return this.getMethods().length > 0;
    }
    public get subtypeOf(): NodeId | null {
        return get_subtypeOf.call(this);
    }
    public get subtypeOfObj(): UAObjectType | null {
        return get_subtypeOfObj.call(this) as any as UAObjectType;
    }
    public isSupertypeOf = tools.construct_isSupertypeOf<UAObjectType>(UAObjectTypeImpl);

    constructor(options: any) {
        super(options);
        this.isAbstract = utils.isNullOrUndefined(options.isAbstract) ? false : options.isAbstract;
    }

    public readAttribute(context: ISessionContext, attributeId: AttributeIds): DataValue {
        assert(context instanceof SessionContext);
        const options: DataValueLike = {};
        switch (attributeId) {
            case AttributeIds.IsAbstract:
                options.value = {
                    dataType: DataType.Boolean,
                    value: !!this.isAbstract
                };
                options.statusCode = StatusCodes.Good;
                break;
            default:
                return BaseNodeImpl.prototype.readAttribute.call(this, context, attributeId);
        }
        return new DataValue(options);
    }

    /**
     * instantiate an object of this UAObjectType
     * The instantiation takes care of object type inheritance when constructing inner properties and components.
     * @method instantiate
     * @param options
     * @param options.browseName
     * @param [options.description]
     * @param [options.organizedBy] the parent Folder holding this object
     * @param [options.componentOf] the parent Object holding this object
     * @param [options.notifierOf]
     * @param [options.eventSourceOf]
     * @param [options.optionals = [] name of the optional child to create
     * @param [options.modellingRule]
     * @param [options.encodingOf]
     *
     *
     * Note : HasComponent usage scope
     *
     *    Source          |     Destination
     * -------------------+---------------------------
     *  Object            | Object, Variable,Method
     *  ObjectType        |
     * -------------------+---------------------------
     *  DataVariable      | Variable
     *  DataVariableType  |
     */
    public instantiate(options: InstantiateObjectOptions): UAObject {
        const addressSpace = this.addressSpace as AddressSpacePrivate;
        assert(!this.isAbstract, "cannot instantiate abstract UAObjectType");

        assert(options, "missing option object");
        assert(
            typeof options.browseName === "string" || (options.browseName !== null && typeof options.browseName === "object"),
            "expecting a browse name"
        );

        assert(!Object.prototype.hasOwnProperty.call(options, "propertyOf"), "an Object shall not be a PropertyOf an other object");
        assert(!Object.prototype.hasOwnProperty.call(options, "optional"), "do you mean optionals ?");

        assertUnusedChildBrowseName(addressSpace, options);

        const baseObjectType = addressSpace.findObjectType("BaseObjectType")!;
        assert(baseObjectType, "BaseObjectType must be defined in the address space");

        const references: UAReference[] = [];

        const copyAlsoModellingRules = topMostParentIsObjectTypeOrVariableType(addressSpace, options);

        const opts: AddObjectOptions = {
            browseName: options.browseName,
            componentOf: options.componentOf,
            displayName: options.displayName || "",
            description: options.description || this.description,
            encodingOf: options.encodingOf,
            eventSourceOf: options.eventSourceOf,
            notifierOf: options.notifierOf,
            organizedBy: options.organizedBy,
            references,

            typeDefinition: this.nodeId,

            nodeId: options.nodeId,

            eventNotifier: options.eventNotifier === undefined ? 0 : options.eventNotifier,

            modellingRule: options.modellingRule
        };

        const namespace = options.namespace || this.addressSpace.getOwnNamespace();

        const instance = namespace.addObject(opts);

        initialize_properties_and_components(instance, baseObjectType, this, copyAlsoModellingRules, options.optionals);

        assert(instance.typeDefinition.toString() === this.nodeId.toString());

        instance.install_extra_properties();

        if (this._postInstantiateFunc) {
            this._postInstantiateFunc(instance, this, options);
        }

        return instance;
    }

    public toString(): string {
        const options = new ToStringBuilder();
        UAObjectType_toString.call(this, options);
        return options.toString();
    }
}
