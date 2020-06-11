/**
 * @module node-opcua-address-space
 */
// tslint:disable:no-console
import * as chalk from "chalk";
import { assert } from "node-opcua-assert";
import * as _ from "underscore";

import { AttributeIds } from "node-opcua-data-model";
import { DiagnosticInfo, NodeClass } from "node-opcua-data-model";
import { DataValue, DataValueLike } from "node-opcua-data-value";
import { NodeId } from "node-opcua-nodeid";
import { Argument, CallMethodResult } from "node-opcua-service-call";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { CallMethodResultOptions } from "node-opcua-types";
import { Variant } from "node-opcua-variant";
import { DataType, VariantLike } from "node-opcua-variant";
import {
    MethodFunctor,
    MethodFunctorCallback,
    UAMethod as UAMethodPublic,
    UAObject as UAObjectPublic,
    UAObjectType
} from "../source";
import { SessionContext } from "../source";
import { BaseNode } from "./base_node";
import { _clone } from "./base_node_private";
import { _handle_hierarchy_parent } from "./namespace";
import { UAVariable } from "./ua_variable";

function default_check_valid_argument(arg: any) {
    return arg.constructor.name === "Argument";
    /*
        var Argument  = require("./_generated_/_auto_generated_Argument").Argument;
        return arg instanceof Argument
    */
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

    public getExecutableFlag(context: SessionContext): boolean {
        if (!_.isFunction(this._asyncExecutionFunction)) {
            return false;
        }
        if (this._getExecutableFlag) {
            return this._getExecutableFlag(context);
        }
        return true;
    }

    public isBound(): boolean {
        return !!this._asyncExecutionFunction;
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
        assert(_.isFunction(async_func));
        this._asyncExecutionFunction = async_func;
    }

    public execute(
        inputArguments: null | VariantLike[],
        context: SessionContext
    ): Promise<CallMethodResultOptions>;
    public execute(
        inputArguments: null | VariantLike[],
        context: SessionContext,
        callback: MethodFunctorCallback
    ): void;
    public execute(
        inputArguments: VariantLike[] | null,
        context: SessionContext,
        callback?: MethodFunctorCallback
    ): any {
        if (!callback) {
            throw new Error("execute need to be promisified");
        }
        assert(inputArguments === null || _.isArray(inputArguments));
        inputArguments = inputArguments || [];
        inputArguments = inputArguments.map(Variant.coerce);
        assert(inputArguments.length === 0 || inputArguments[0] instanceof Variant);
        assert(_.isObject(context));
        assert(_.isFunction(callback));

        // a context object must be provided
        if (!context.object) {
            context.object = this.parent;
        }

        assert(context.object instanceof BaseNode);
        if (context.object.nodeClass !== NodeClass.Object && context.object.nodeClass !== NodeClass.ObjectType) {
            console.log("Method " + this.nodeId.toString() + " " + this.browseName.toString() +
                " called for a node that is not a Object/ObjectType but " + NodeClass[context.object.nodeClass]);
            return callback(null, { statusCode: StatusCodes.BadNodeIdInvalid });
        }
        if (!this._asyncExecutionFunction) {
            console.log("Method " + this.nodeId.toString() + " " + this.browseName.toString() + "_ has not been bound");
            return callback(null, { statusCode: StatusCodes.BadInternalError });
        }

        if (!this.getExecutableFlag(context)) {
            console.log("Method " + this.nodeId.toString() + " " + this.browseName.toString() + "_ is not executable");
            // todo : find the correct Status code to return here
            return callback(null, { statusCode: StatusCodes.BadMethodInvalid });
        }
        // verify that input arguments are correct
        // todo :
        const inputArgumentResults: StatusCode[] = [];
        const inputArgumentDiagnosticInfos: DiagnosticInfo[] = [];

        try {

            this._asyncExecutionFunction.call(
                (this as UAMethodPublic),
                inputArguments as Variant[],
                context,
                (err: Error | null, callMethodResult: CallMethodResultOptions) => {

                    if (err) {
                        console.log(err.message);
                        console.log(err);
                    }
                    callMethodResult = callMethodResult || {};

                    callMethodResult.statusCode = callMethodResult.statusCode || StatusCodes.Good;
                    callMethodResult.outputArguments = callMethodResult.outputArguments || [];

                    callMethodResult.inputArgumentResults = inputArgumentResults;
                    callMethodResult.inputArgumentDiagnosticInfos = inputArgumentDiagnosticInfos;

                    // verify that output arguments are correct according to schema
                    // Todo : ...
                    const outputArgsDef = this.getOutputArguments();

                    // xx assert(outputArgsDef.length === callMethodResponse.outputArguments.length,
                    // xx     "_asyncExecutionFunction did not provide the expected number of output arguments");
                    // to be continued ...

                    callback(err, callMethodResult);

                });

        } catch (err) {
            // tslint:disable:no-console
            console.log(chalk.red("ERR in method  handler"), err.message);
            console.error(err.stack);
            const callMethodResponse = { statusCode: StatusCodes.BadInternalError };
            callback(err, callMethodResponse);
        }
    }

    public clone(
        options: any,
        optionalFilter?: any,
        extraInfo?: any
    ): UAMethodPublic {

        assert(!options.componentOf || options.componentOf, "trying to create an orphan method ?");

        options = options || {};
        options = _.extend(_.clone(options), {
            methodDeclarationId: this.nodeId
        });
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
        assert(_.isArray(args));
        assert(args.length === 0 || UAMethod.checkValidArgument(args[0]));
        return args;
    }

}

// tslint:disable:no-var-requires
// tslint:disable:max-line-length
const thenify = require("thenify");
UAMethod.prototype.execute = thenify.withCallback(UAMethod.prototype.execute);
