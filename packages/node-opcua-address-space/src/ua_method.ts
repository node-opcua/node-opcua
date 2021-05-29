/**
 * @module node-opcua-address-space
 */
import * as chalk from "chalk";
import { assert } from "node-opcua-assert";

import { AttributeIds } from "node-opcua-data-model";
import { DiagnosticInfo, NodeClass } from "node-opcua-data-model";
import { DataValue, DataValueLike } from "node-opcua-data-value";
import { make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { NodeId } from "node-opcua-nodeid";
import { Argument } from "node-opcua-service-call";
import { StatusCodes } from "node-opcua-status-code";
import { CallMethodResultOptions, PermissionType } from "node-opcua-types";
import { Variant } from "node-opcua-variant";
import { DataType, VariantLike } from "node-opcua-variant";
import {
    MethodFunctor,
    MethodFunctorCallback,
    UAMethod as UAMethodPublic,
    UAObject as UAObjectPublic,
} from "../source";
import { SessionContext } from "../source";
import { BaseNode } from "./base_node";
import { _clone } from "./base_node_private";
import { _handle_hierarchy_parent } from "./namespace";
import { UAObject } from "./ua_object";
import { UAObjectType } from "./ua_object_type";
import { UAVariable } from "./ua_variable";


const warningLog = make_warningLog(__filename);
const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);

function default_check_valid_argument(arg: any) {
    return arg.constructor.name === "Argument";
}

export class UAMethod extends BaseNode implements UAMethodPublic {
    public static checkValidArgument(args: any) {
        return default_check_valid_argument(args);
    }

    public readonly nodeClass = NodeClass.Method;

    public get typeDefinitionObj(): UAObjectType {
        return super.typeDefinitionObj as UAObjectType;
    }

    public get parent(): UAObjectPublic | null {
        return super.parent as UAObjectPublic;
    }

    public value?: any;
    public methodDeclarationId: NodeId;
    public _getExecutableFlag?: (this: UAMethod, context: SessionContext) => boolean;

    public _asyncExecutionFunction?: MethodFunctor;

    constructor(options: any) {
        super(options);
        this.value = options.value;
        this.methodDeclarationId = options.methodDeclarationId;
    }

    /**
     *
     * 
     */
    public getExecutableFlag(context: SessionContext): boolean {
        if (!this.isBound()) {
            return false;
        }
        if (this._getExecutableFlag) {
            return this._getExecutableFlag(context);
        }
        return true;
    }

    /**
     * 
     * @returns  true if the method is bound
     */
    public isBound(): boolean {
        return typeof this._asyncExecutionFunction === "function";
    }

    public readAttribute(context: SessionContext, attributeId: AttributeIds): DataValue {
        const options: DataValueLike = {};
        switch (attributeId) {
            case AttributeIds.Executable:
                options.value = { dataType: DataType.Boolean, value: this.getExecutableFlag(context) };
                options.statusCode = StatusCodes.Good;
                break;
            case AttributeIds.UserExecutable:
                options.value = { dataType: DataType.Boolean, value: this.getExecutableFlag(context) };
                options.statusCode = StatusCodes.Good;
                break;
            default:
                return BaseNode.prototype.readAttribute.call(this, context, attributeId);
        }
        return new DataValue(options);
    }

    public getInputArguments(): Argument[] {
        return this._getArguments("InputArguments");
    }

    public getOutputArguments(): Argument[] {
        return this._getArguments("OutputArguments");
    }

    public bindMethod(async_func: MethodFunctor): void {
        assert(typeof async_func === "function");
        this._asyncExecutionFunction = async_func;
    }
    public execute(object: UAObject | UAObjectType | null, inputArguments: null | VariantLike[], context: SessionContext): Promise<CallMethodResultOptions>;
    public execute(object: UAObject | UAObjectType | null, inputArguments: null | VariantLike[], context: SessionContext, callback: MethodFunctorCallback): void;
    public execute(object: UAObject | UAObjectType | null, inputArguments: VariantLike[] | null, context: SessionContext, callback?: MethodFunctorCallback): any {
        // istanbul ignore next 
        if (!callback) {
            throw new Error("execute need to be promisified");
        }
        assert(inputArguments === null || Array.isArray(inputArguments));
        inputArguments = inputArguments || [];
        inputArguments = inputArguments.map(Variant.coerce);
        assert(inputArguments.length === 0 || inputArguments[0] instanceof Variant);
        assert(context !== null && typeof context === "object");
        assert(typeof callback === "function");

        object = object || this.parent as UAObject;

        // istanbul ignore next
        if (!object) {
            errorLog("UAMethod#execute expects a valid object");
            return callback(null, { statusCode: StatusCodes.BadInternalError });
        }

        if (object.nodeClass !== NodeClass.Object && object.nodeClass !== NodeClass.ObjectType) {
            warningLog(
                "Method " +
                this.nodeId.toString() +
                " " +
                this.browseName.toString() +
                " called for a node that is not a Object/ObjectType but " +
                NodeClass[context.object.nodeClass]
            );
            return callback(null, { statusCode: StatusCodes.BadNodeIdInvalid });
        }
        if (!this._asyncExecutionFunction) {
            warningLog("Method " + this.nodeId.toString() + " " + this.browseName.toString() + " has not been bound");
            return callback(null, { statusCode: StatusCodes.BadInternalError });
        }


        if (!this.getExecutableFlag(context)) {
            warningLog("Method " + this.nodeId.toString() + " " + this.browseName.toString() + " is not executable");
            return callback(null, { statusCode: StatusCodes.BadNotExecutable });
        }

        if (context.isAccessRestricted(this)) {
            return callback(null, { statusCode: StatusCodes.BadSecurityModeInsufficient });
        }

        if (!context.checkPermission(this, PermissionType.Call)) {
            return callback(null, { statusCode: StatusCodes.BadUserAccessDenied });
        }

        // verify that input arguments are correct
        // todo :
        const inputArgumentDiagnosticInfos: DiagnosticInfo[] = [];

        context.object = object;

        try {
            this._asyncExecutionFunction.call(
                this as UAMethodPublic,
                inputArguments as Variant[],
                context,
                (err: Error | null, callMethodResult: CallMethodResultOptions) => {
                    if (err) {
                        debugLog(err.message);
                        debugLog(err);
                    }
                    callMethodResult = callMethodResult || {};

                    callMethodResult.statusCode = callMethodResult.statusCode || StatusCodes.Good;
                    callMethodResult.outputArguments = callMethodResult.outputArguments || [];

                    callMethodResult.inputArgumentResults =
                        callMethodResult.inputArgumentResults?.length === inputArguments?.length
                            ? callMethodResult.inputArgumentResults
                            : inputArguments?.map(() => StatusCodes.Good);
                    callMethodResult.inputArgumentDiagnosticInfos =
                        callMethodResult.inputArgumentDiagnosticInfos || inputArgumentDiagnosticInfos;

                    // verify that output arguments are correct according to schema
                    // Todo : ...
                    // const outputArgsDef = this.getOutputArguments();

                    // xx assert(outputArgsDef.length === callMethodResponse.outputArguments.length,
                    // xx     "_asyncExecutionFunction did not provide the expected number of output arguments");
                    // to be continued ...

                    callback(err, callMethodResult);
                }
            );
        } catch (err) {
            warningLog(chalk.red("ERR in method  handler"), err.message);
            warningLog(err.stack);
            const callMethodResponse = { statusCode: StatusCodes.BadInternalError };
            callback(err, callMethodResponse);
        }
    }

    public clone(options: any, optionalFilter?: any, extraInfo?: any): UAMethodPublic {
        assert(!options.componentOf || options.componentOf, "trying to create an orphan method ?");

        options = options || {};
        options = { ...options, methodDeclarationId: this.nodeId };
        options.references = options.references || [];

        const addressSpace = this.addressSpace;
        _handle_hierarchy_parent(addressSpace, options.references, options);

        const clonedMethod = _clone.call(this, UAMethod, options, optionalFilter, extraInfo) as UAMethod;

        clonedMethod._asyncExecutionFunction = this._asyncExecutionFunction;
        clonedMethod._getExecutableFlag = this._getExecutableFlag;

        if (options.componentOf) {
            const m = options.componentOf.getMethodByName(clonedMethod.browseName.name);
            assert(m);
        }
        return clonedMethod as UAMethodPublic;
    }

    private _getArguments(name: string): Argument[] {
        assert(name === "InputArguments" || name === "OutputArguments");
        const argsVariable = this.getPropertyByName(name);
        if (!argsVariable) {
            return [];
        }

        assert(argsVariable.nodeClass === NodeClass.Variable);

        const args = (argsVariable as UAVariable).readValue().value.value;
        if (!args) {
            return [];
        }
        // a list of extension object
        assert(Array.isArray(args));
        assert(args.length === 0 || UAMethod.checkValidArgument(args[0]));
        return args;
    }
}

// tslint:disable:no-var-requires
// tslint:disable:max-line-length
const thenify = require("thenify");
UAMethod.prototype.execute = thenify.withCallback(UAMethod.prototype.execute);
