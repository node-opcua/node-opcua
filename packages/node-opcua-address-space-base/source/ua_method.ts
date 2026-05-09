import type { NodeClass } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import type { CallbackT } from "node-opcua-status-code";
import type { Argument, CallMethodResultOptions } from "node-opcua-types";
import type { Variant, VariantLike } from "node-opcua-variant";
import type { BaseNode, BaseNodeEvents, ListenerSignature } from "./base_node";
import type { CloneExtraInfo, CloneFilter, CloneOptions } from "./clone_options";
import type { ISessionContext } from "./session_context";
import type { UAObject } from "./ua_object";
import type { UAObjectType } from "./ua_object_type";
import type { UAVariable } from "./ua_variable";

export declare type MethodFunctorC = (
    this: UAMethod,
    inputArguments: Variant[],
    context: ISessionContext,
    callback: CallbackT<CallMethodResultOptions>
) => void;
export declare type MethodFunctorA = (
    this: UAMethod,
    inputArguments: Variant[],
    context: ISessionContext
) => Promise<CallMethodResultOptions>;

export type MethodFunctor = MethodFunctorC | MethodFunctorA;


export interface UAMethodEvents extends BaseNodeEvents {
    "method_executed": (inputArguments: Variant[], context: ISessionContext, callMethodResult: CallMethodResultOptions) => void;
    "afterCall": (context: ISessionContext,inputArguments: Variant[], callMethodResult: CallMethodResultOptions) => void;
}
export interface UAMethod<T extends UAMethodEvents & ListenerSignature<T>   = UAMethodEvents> extends BaseNode<T> {
    readonly nodeClass: NodeClass.Method;
    readonly typeDefinition: NodeId;
    readonly typeDefinitionObj: UAObjectType;

    readonly parent: UAObject | null;

    readonly inputArguments?: UAVariable;
    readonly outputArguments?: UAVariable;

    readonly methodDeclarationId: NodeId;

    /**
     *
     */
    _getExecutableFlag?: (sessionContext: ISessionContext | null) => boolean;

    bindMethod(methodFunction: MethodFunctor): void;

    getExecutableFlag(context: ISessionContext): boolean;

    getInputArguments(): Argument[];

    getOutputArguments(): Argument[];

    /**
     */
    execute(
        object: UAObject | UAObjectType | null,
        inputArguments: VariantLike[] | null,
        context: ISessionContext,
        callback: CallbackT<CallMethodResultOptions>
    ): void;
    execute(
        object: UAObject | UAObjectType | null,
        inputArguments: null | VariantLike[],
        context: ISessionContext
    ): Promise<CallMethodResultOptions>;

    clone(options: CloneOptions, optionalFilter?: CloneFilter, extraInfo?: CloneExtraInfo): UAMethod;

    isBound(): boolean;
}
