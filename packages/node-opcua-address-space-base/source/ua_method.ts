import type { DiagnosticInfoOptions, NodeClass } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import type { CallbackT } from "node-opcua-status-code";
import type { Argument, CallMethodResultOptions } from "node-opcua-types";
import type { Variant, VariantLike } from "node-opcua-variant";
import type { BaseNode, BaseNodeEvents, ListenerSignature } from "./base_node.js";
import type { CloneExtraInfo, CloneFilter, CloneOptions } from "./clone_options.js";
import type { ISessionContext } from "./session_context.js";
import type { UAObject } from "./ua_object.js";
import type { UAObjectType } from "./ua_object_type.js";
import type { UAVariable } from "./ua_variable.js";

/**
 * What a method implementation returns: the CallMethodResult, plus an optional DiagnosticInfo for its statusCode.
 *
 * OPC 10000-4 v1.05.07 §5.12.2 Call: the CallResponse `diagnosticInfos` is the "List of diagnostic information for
 * the statusCode of the results", returned when the Client asks for operation-level diagnostics through
 * `returnDiagnostics` in the RequestHeader (§7.33). A Server that reuses a StatusCode for an application specific
 * meaning should put the application specific description there. `diagnosticInfo` is not part of the encoded
 * CallMethodResult: the server moves it into `CallResponse.diagnosticInfos`, at the index of this result.
 * Prefer `additionalInfo`: it needs no entry in the response string table.
 */
export interface MethodResult extends CallMethodResultOptions {
    diagnosticInfo?: DiagnosticInfoOptions;
}

export declare type MethodFunctorC = (
    this: UAMethod,
    inputArguments: Variant[],
    context: ISessionContext,
    callback: CallbackT<MethodResult>
) => void;
export declare type MethodFunctorA = (this: UAMethod, inputArguments: Variant[], context: ISessionContext) => Promise<MethodResult>;

export type MethodFunctor = MethodFunctorC | MethodFunctorA;

export interface UAMethodEvents extends BaseNodeEvents {
    method_executed: (inputArguments: Variant[], context: ISessionContext, callMethodResult: CallMethodResultOptions) => void;
    afterCall: (context: ISessionContext, inputArguments: Variant[], callMethodResult: CallMethodResultOptions) => void;
}
export interface UAMethod<T extends UAMethodEvents & ListenerSignature<T> = UAMethodEvents> extends BaseNode<T> {
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
