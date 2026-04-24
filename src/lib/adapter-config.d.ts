// This file extends the AdapterConfig type from "@iobroker/types"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
    namespace ioBroker {
        interface AdapterConfig {
            mqtt_broker: string;
            mqtt_port: number;
            mqtt_user: string;
            mqtt_pass: string;
            hannah_topic: string;
        }
    }
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};