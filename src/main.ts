/*
 * Created with @iobroker/create-adapter v3.1.2
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';
import * as mqtt from 'mqtt';
import type { MqttClient } from 'mqtt';

interface NotificationMessage {
    category?: {
        severity?: string;
        description?: string | { de?: string; en?: string };
        name?: string | { de?: string; en?: string };
        instances?: Record<string, { messages?: Array<{ message?: string }> }>;
    };
    instances?: Record<string, { messages?: Array<{ message?: string }> }>;
}

class HannahNotificationmanager extends utils.Adapter {
    private mqttClient: MqttClient | null = null;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'hannah-notificationmanager',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    private onReady(): void {
        const { mqtt_broker, mqtt_port, mqtt_user, mqtt_pass } = this.config;

        this.mqttClient = mqtt.connect(`mqtt://${mqtt_broker}:${mqtt_port}`, {
            username: mqtt_user || undefined,
            password: mqtt_pass || undefined,
            clientId: `iobroker-${this.namespace}`,
            reconnectPeriod: 5000,
        });

        this.mqttClient.on('connect', () => {
            this.log.info(`MQTT verbunden: ${mqtt_broker}:${mqtt_port}`);
            void this.setState('info.connection', true, true);
        });
        this.mqttClient.on('error', (err: Error) => {
            this.log.error(`MQTT Fehler: ${err.message}`);
            void this.setState('info.connection', false, true);
        });
        this.mqttClient.on('close', () => {
            void this.setState('info.connection', false, true);
        });
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param callback - Callback function
     */
    private onUnload(callback: () => void): void {
        try {
            this.mqttClient?.end();
            callback();
        } catch (error) {
            this.log.error(`Error during unloading: ${(error as Error).message}`);
            callback();
        }
    }

    public onMessage(obj: ioBroker.Message): void {
        if (!obj || obj.command !== 'sendNotification') {
            return;
        }

        this.log.debug(`sendNotification: ${JSON.stringify(obj.message)}`);
        const notification = obj.message as NotificationMessage | undefined;
        const text = this.extractText(notification);

        if (!text) {
            this.log.warn('Notification ohne Text empfangen — ignoriert.');
            if (obj.callback) {
                this.sendTo(obj.from, obj.command, { sent: false, error: 'Kein Text' }, obj.callback);
            }
            return;
        }

        const severity = notification?.category?.severity ?? 'notify';
        const payload = JSON.stringify({ text, severity });

        if (this.mqttClient?.connected) {
            this.mqttClient.publish(this.config.hannah_topic, payload, { qos: 1 }, (err?: Error) => {
                if (err) {
                    this.log.error(`Publish fehlgeschlagen: ${err.message}`);
                    if (obj.callback) {
                        this.sendTo(obj.from, obj.command, { sent: false, error: err.message }, obj.callback);
                    }
                } else {
                    this.log.info(`Notification → Hannah: [${severity}] "${text}"`);
                    if (obj.callback) {
                        this.sendTo(obj.from, obj.command, { sent: true }, obj.callback);
                    }
                }
            });
        } else {
            this.log.warn('MQTT nicht verbunden — Notification verworfen.');
            if (obj.callback) {
                this.sendTo(obj.from, obj.command, { sent: false, error: 'MQTT nicht verbunden' }, obj.callback);
            }
        }
    }

    private extractText(notification: NotificationMessage | undefined): string | null {
        try {
            const instances = notification?.category?.instances ?? notification?.instances ?? {};
            const parts: string[] = [];
            for (const data of Object.values(instances)) {
                for (const msg of data.messages ?? []) {
                    if (msg.message) {
                        parts.push(msg.message);
                    }
                }
            }
            if (parts.length) {
                return parts.join('. ');
            }

            const desc = notification?.category?.description;
            if (typeof desc === 'string') {
                return desc;
            }
            if (desc && typeof desc === 'object') {
                return desc.de ?? desc.en ?? null;
            }

            const name = notification?.category?.name;
            if (typeof name === 'string') {
                return name;
            }
            if (name && typeof name === 'object') {
                return name.de ?? name.en ?? null;
            }
        } catch (e) {
            this.log.warn(`Text-Extraktion fehlgeschlagen: ${(e as Error).message}`);
        }
        return null;
    }
}

if (require.main !== module) {
    module.exports = (options: Partial<utils.AdapterOptions> | undefined): HannahNotificationmanager =>
        new HannahNotificationmanager(options);
} else {
    (() => new HannahNotificationmanager())();
}
