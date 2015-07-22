"use strict";
/**
 *
 * This Service is used to call (invoke) a list of Methods. Each method call is invoked within the context
 * of an existing Session. If the Session is terminated, the results of the method’s execution cannot be
 * returned to the Client and are discarded. This is independent of the task actually performed at the
 * Server.
 * This Service provides for passing input and output arguments to/from a method. These arguments
 * are defined by Properties of the method.
 *
 * @module services.method
 */

require("requirish")._(module);
/*
 *
 *
 * extract from OPCUA Specification Part 4 Release 1.02 page 61:
 *
 * 5.11 **Method Service Set**
 *
 * 5.11.1 Overview
 *   Methods represent the function calls of Objects. They are defined in Part 3. Methods are invoked
 *   and return only after completion (successful or unsuccessful). Execution times for methods may
 *   vary, depending on the function that they perform.
 *   The Method Service Set defines the means to invoke methods. A method shall be a component of an
 *   Object. Discovery is provided through the Browse and Query Services. Clients discover the methods
 *   supported by a Server by browsing for the owning Objects References that identify their supported
 *   methods.
 *   Because Methods may control some aspect of plant operations, method invocation may depend on
 *   environmental or other conditions. This may be especially true when attempting to re -invoke a
 *   method immediately after it has completed execution. Conditions that are required to invoke the
 *   method might not yet have returned to the state that permits the method to start again.
 *
 *
 */


/**
 * @class CallMethodRequest
 */
exports.CallMethodRequest = require("_generated_/_auto_generated_CallMethodRequest").CallMethodRequest;
/**
 * @class CallRequest
 */
exports.CallRequest = require("_generated_/_auto_generated_CallRequest").CallRequest;
/**
 * @class CallMethodResult
 */
exports.CallMethodResult = require("_generated_/_auto_generated_CallMethodResult").CallMethodResult;
/**
 * @class CallResponse
 */
exports.CallResponse = require("_generated_/_auto_generated_CallResponse").CallResponse;
