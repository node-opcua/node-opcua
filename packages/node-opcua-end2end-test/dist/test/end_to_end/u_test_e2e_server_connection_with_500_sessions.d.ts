interface TestHarness {
    endpointUrl: string;
    server: {
        engine: {
            serverCapabilities: {
                maxSessions: number;
            };
        };
    };
}
export declare function t(test: TestHarness): void;
export {};
//# sourceMappingURL=u_test_e2e_server_connection_with_500_sessions.d.ts.map