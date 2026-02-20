import { useState, useCallback, useRef } from 'react';
import { parseAcceleration, parseQuaternion, VelocityIntegrator } from '../utils/math';

// WitMotion BLE UUIDs are dynamically discovered because WT901BLE67 uses different variants
// 0xffe5 (Standard WitMotion), 0xffe0 (Standard BLE Serial), etc.

export function useBluetooth() {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [velocity, setVelocity] = useState<number>(0);
    const [peakVelocity, setPeakVelocity] = useState<number>(0);
    const [accelerationZ, setAccelerationZ] = useState<number>(0);

    const deviceRef = useRef<BluetoothDevice | null>(null);
    const characteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
    const integratorRef = useRef(new VelocityIntegrator());

    const latestQuatRef = useRef({ q0: 1, q1: 0, q2: 0, q3: 0 });

    const handleCharacteristicValueChanged = useCallback((event: Event) => {
        const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
        const value = characteristic.value;
        if (!value) return;

        const buffer = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);

        if (buffer[0] === 0x55) {
            if (buffer[1] === 0x59) {
                const q = parseQuaternion(buffer);
                if (q) latestQuatRef.current = q;
            } else if (buffer[1] === 0x51) {
                // Many WitMotion standard mobile firmwares are locked to 2g or 16g out of the box
                // Set gRange=2 as fallback
                const a = parseAcceleration(buffer, 2);
                if (a) {
                    setAccelerationZ(a.z);
                    // Math pipeline integration
                    const currentVel = integratorRef.current.update(a.z, latestQuatRef.current);
                    setVelocity(currentVel);

                    setPeakVelocity((prev) => currentVel > prev ? currentVel : prev);
                }
            }
        }
    }, []);

    const handleDisconnect = useCallback(() => {
        console.log('Device disconnected');
        setIsConnected(false);
        deviceRef.current = null;
        characteristicRef.current = null;
        integratorRef.current.reset();
    }, []);

    const resetPeak = useCallback(() => {
        setPeakVelocity(0);
    }, []);

    const connect = async () => {
        setIsConnecting(true);
        setError(null);

        try {
            // Requesting all known WitMotion and standard serial BLE service UUIDs
            // Explicitly including the 128-bit string for ffe5 to bypass Android cache bugs
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: 'WT' }],
                optionalServices: [
                    '0000ffe5-0000-1000-8000-00805f9b34fb', // Explicit 128-bit Android
                    0xffe5, // Standard WitMotion
                    0xffe0, // Standard BLE Serial (often used by WT901BLE67)
                    0xffa0, // Alternative WitMotion
                    '49535343-fe7d-4ae5-8fa9-9fafd205e455' // Transparent UART
                ]
            });

            deviceRef.current = device;
            device.addEventListener('gattserverdisconnected', handleDisconnect);

            if (!device.gatt) throw new Error('No GATT server found');

            const server = await device.gatt.connect();

            // MANDATORY DELAY FOR ANDROID
            // Android often claims connection is established before services are fully discovered.
            await new Promise(resolve => setTimeout(resolve, 600));

            // Dynamically find the right service and characteristic
            const services = await server.getPrimaryServices();
            let targetChar: BluetoothRemoteGATTCharacteristic | null = null;

            for (const service of services) {
                console.log(`Checking Service: ${service.uuid}`);
                const characteristics = await service.getCharacteristics();
                for (const char of characteristics) {
                    console.log(`  Checking Characteristic: ${char.uuid}`);
                    if (char.properties.notify) {
                        targetChar = char;
                        console.log(`    -> Selected! (Supports Notify)`);
                        break;
                    }
                }
                if (targetChar) break;
            }

            if (!targetChar) {
                throw new Error('No compatible notifying characteristic found on device.');
            }

            characteristicRef.current = targetChar;
            targetChar.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);
            await targetChar.startNotifications();

            setIsConnected(true);
        } catch (err: any) {
            console.error('Connection error:', err);
            setError(err.message || 'Failed to connect to sensor');
        } finally {
            setIsConnecting(false);
        }
    };

    const disconnect = () => {
        if (deviceRef.current?.gatt?.connected) {
            deviceRef.current.gatt.disconnect();
        }
    };

    return {
        isConnected,
        isConnecting,
        error,
        velocity,
        peakVelocity,
        accelerationZ,
        connect,
        disconnect,
        resetPeak
    };
}
