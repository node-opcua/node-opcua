using System;
using System.Threading;
using System.Threading.Tasks;
using Opc.Ua;
using Opc.Ua.Configuration;
using Opc.Ua.Server;

namespace BasicOpcUaServer
{
    // Derive from StandardServer to create a custom OPC UA server.
    public class MyOpcUaServer : StandardServer
    {
        // Override to set server properties like Manufacturer, ProductName etc.
        protected override ServerProperties LoadServerProperties()
        {
            return new ServerProperties
            {
                ManufacturerName = "My Company",
                ProductName = "Basic OPC UA Server",
                ProductUri = "urn:mycompany:basicopcuaserver",
                SoftwareVersion = "1.0.0",
                BuildNumber = "1",
                BuildDate = DateTime.UtcNow
            };
        }

        protected override void OnServerStarting(ApplicationConfiguration configuration)
        {
            base.OnServerStarting(configuration);
            Console.WriteLine("Starting OPC UA server...");
        }

        protected override void OnServerStarted(IServerInternal server)
        {
            base.OnServerStarted(server);
            Console.WriteLine("OPC UA server started and listening...");
        }
    }

    class Program
    {
        static async Task Main(string[] args)
        {
            // Build an application configuration for the OPC UA server
            var config = new ApplicationConfiguration
            {
                ApplicationName = "Basic OPC UA Server with DotNet Core by Sterfive",
                ApplicationUri = "urn:sterfive:basicopcuaserver",
                ApplicationType = ApplicationType.Server,
                SecurityConfiguration = new SecurityConfiguration
                {
                    // In production, you should properly handle certificates
                    AutoAcceptUntrustedCertificates = true,
                    ApplicationCertificate = new CertificateIdentifier()
                    {
                        StoreType = "Directory",
                        StorePath = "CertificateStores/MachineDefault",
                        SubjectName = "CN=Basic OPC UA Server, O=My Company, C=US"
                    },
                },
                ServerConfiguration = new ServerConfiguration
                {
                    // Base address where the server will be listening
                    BaseAddresses = { "opc.tcp://localhost:4840" },
                    // Other server configuration settings can be set here
                    SecurityPolicies = new ServerSecurityPolicyCollection
                    {
                        new ServerSecurityPolicy
                        {
                            SecurityPolicyUri = SecurityPolicies.None,
                            SecurityMode = MessageSecurityMode.None
                        },
                        // You can also add other policies, e.g.:
                        // new ServerSecurityPolicy
                        // {
                        //     SecurityPolicyUri = SecurityPolicies.Basic256Sha256,
                        //     SecurityMode      = MessageSecurityMode.SignAndEncrypt
                        // }
                    }
                },
                TransportConfigurations = new TransportConfigurationCollection(),
                TransportQuotas = new TransportQuotas { OperationTimeout = 15000 },
                ClientConfiguration = new ClientConfiguration { DefaultSessionTimeout = 60000 }
            };

            // Validate the configuration (and create certificates if needed)
            await config.Validate(ApplicationType.Server);

            // Create an ApplicationInstance and check the certificate.
            var application = new ApplicationInstance
            {
                ApplicationName = config.ApplicationName,
                ApplicationType = ApplicationType.Server,
                ApplicationConfiguration = config,
            };

            bool haveAppCertificate = await application.CheckApplicationInstanceCertificate(
                false,
                0
            );
            if (!haveAppCertificate)
            {
                throw new Exception("Application instance certificate invalid!");
            }

            // Create and start the OPC UA server
            var server = new MyOpcUaServer();
            server.Start(config);

            Console.WriteLine("Press Ctrl-C to exit...");

            // Wait until the process is terminated (Ctrl-C)
            var quitEvent = new ManualResetEvent(false);
            Console.CancelKeyPress += (sender, eArgs) =>
            {
                eArgs.Cancel = true;
                quitEvent.Set();
            };

            quitEvent.WaitOne();

            // Stop the server gracefully
            server.Stop();
        }
    }
}
