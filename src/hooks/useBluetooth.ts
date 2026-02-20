import { useState, useCallback, useRef } from 'react';
import { parseAcceleration, parseQuaternion, VelocityIntegrator } from '../utils/math';

// WitMotion BLE UUIDs (Standard WT9011DCL)
// Some firmwares like WT901BLE67 require the full 128-bit UUID string in Web Bluetooth
const WITMOTION_SERVICE_UUID = '0000ffe5-0000-1000-8000-00805f9b34fb';
const WITMOTION_CHAR_UUID = '0000ffe4-0000-1000-8000-00805f9b34fb';

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
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: 'WT' }],
                optionalServices: [WITMOTION_SERVICE_UUID]
            });

            deviceRef.current = device;
            device.addEventListener('gattserverdisconnected', handleDisconnect);

            if (!device.gatt) throw new Error('No GATT server found');

            const server = await device.gatt.connect();
            const service = await server.getPrimaryService(WITMOTION_SERVICE_UUID);
            const characteristic = await service.getCharacteristic(WITMOTION_CHAR_UUID);

            characteristicRef.current = characteristic;
            characteristic.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);
            await characteristic.startNotifications();

            setIsConnected(true);
        } catch (err: any) {
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
