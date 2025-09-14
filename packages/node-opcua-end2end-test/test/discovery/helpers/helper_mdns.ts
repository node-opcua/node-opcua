

import chalk from "chalk";
import { Bonjour } from "sterfive-bonjour-service";


const { red, blue } = chalk;


export async function cleanUpmDNSandSanityCheck() {

    console.log(red("============================================== SANITY CHECK ==============="));
    const bonjour = new Bonjour();
    // Store references to the services we've re-announced
    const reannouncedServices = new Map();

    // Find all available services
    const browser = bonjour.find({
        protocol: "tcp",
        type: "opcua-tcp"
    }, (service) => {
        console.log('Found service:', service.name);
        console.log('  Type:', service.type);
        console.log('  Protocol:', service.protocol);
        console.log('  Port:', service.port);
        console.log('  Host:', service.host);
        console.log('  Addresses:', service.addresses);
        console.log('------------------------------');


        if (!reannouncedServices.has(service.name)) {
            console.log(red('Found service:', service.name, 'and re-announcing it...'));

            // Re-announce the service with its original details
            try {
                const publishedService = bonjour.publish({
                    name: service.name,
                    type: service.type,
                    protocol: service.protocol,
                    port: service.port,
                    txt: service.txt // Include TXT records if available
                    ,
                    // IMPORTANT
                    probe: false,

                });
                // Store the published service instance
                reannouncedServices.set(service.name, publishedService);
            } catch (err) {

            }

        }
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    // Function to stop all re-announced services
    const stopAllReannouncedServices = async () => {
        if (reannouncedServices.size == 0) return;

        console.log(red('\nStopping all re-announced services...'));

        // Iterate through the map of services we've published
        reannouncedServices.forEach((publishedService, serviceName) => {
            new Promise<void>((resolve) => {
                publishedService.stop(() => {
                    console.log('Stopped service:', serviceName);
                    resolve();
                });;
            })
        });

    };

    // Call the function to stop the services after a delay
    await stopAllReannouncedServices(); // Stop after 10 seconds    // The browser will continue to listen for new services.
    // You can stop it manually later if needed:

    browser.stop();
    bonjour.destroy();
    console.log(red("============================================== SANITY CHECK DONE ==============="));

}