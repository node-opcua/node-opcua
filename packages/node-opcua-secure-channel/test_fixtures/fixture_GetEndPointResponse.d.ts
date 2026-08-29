// hand-written declaration for the JS fixture, typing only what the tests use
import type { EndpointDescription, GetEndpointsResponse } from "node-opcua-service-endpoints";

export const fixture1: GetEndpointsResponse;
export const fixture2: GetEndpointsResponse;
export const fixture3: GetEndpointsResponse;
export const fixture4: GetEndpointsResponse;
export function makeEndPoint(): EndpointDescription;
