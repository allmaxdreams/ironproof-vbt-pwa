/**
 * VBT Tracker Math Pipeline
 * Includes Quaternion Parsing, Gravity Compensation,
 * Butterworth Low-Pass Filter, and Velocity Integration.
 */

// 1. Data Parsing from WitMotion Hex Packets
// WT9011 Protocol: 11 bytes per packet. Header is 0x55.
// 0x51: Acceleration -> [0x55, 0x51, AxL, AxH, AyL, AyH, AzL, AzH, TL, TH, SUM]
// 0x59: Quaternion -> [0x55, 0x59, q0L, q0H, q1L, q1H, q2L, q2H, q3L, q3H, SUM]

export function parseAcceleration(buffer: Uint8Array): { x: number; y: number; z: number } | null {
    if (buffer.length < 11 || buffer[0] !== 0x55 || buffer[1] !== 0x51) return null;
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    // Resolution: 16g / 32768, Output in g
    const x = (view.getInt16(2, true) / 32768) * 16 * 9.81;
    const y = (view.getInt16(4, true) / 32768) * 16 * 9.81;
    const z = (view.getInt16(6, true) / 32768) * 16 * 9.81;
    return { x, y, z };
}

export function parseQuaternion(buffer: Uint8Array): { q0: number; q1: number; q2: number; q3: number } | null {
    if (buffer.length < 11 || buffer[0] !== 0x55 || buffer[1] !== 0x59) return null;
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    const q0 = view.getInt16(2, true) / 32768;
    const q1 = view.getInt16(4, true) / 32768;
    const q2 = view.getInt16(6, true) / 32768;
    const q3 = view.getInt16(8, true) / 32768;
    return { q0, q1, q2, q3 };
}

// 2. Gravity Compensation
// Extract Earth's gravity vector in the sensor's coordinate system and subtract
export function getLinearAccelerationBaseZ(rawAccel: { x: number, y: number, z: number }, q: { q0: number, q1: number, q2: number, q3: number }) {
    const g_z = (q.q0 * q.q0 - q.q1 * q.q1 - q.q2 * q.q2 + q.q3 * q.q3);
    // Subtracting gravity to get clean linear acceleration in Z-axis (up/down)
    return rawAccel.z - (g_z * 9.81);
}

// 3. Digital IIR Filter (Butterworth 4th Order Low-Pass)
// Pre-calculated coefficients for 20Hz Sample Rate, 5Hz Cutoff (Nyquist = 10Hz)
export class ButterworthLowPass {
    private xv = [0, 0, 0, 0, 0];
    private yv = [0, 0, 0, 0, 0];

    public filter(val: number): number {
        // Coefficients for 4th order Butterworth, Fs=20Hz, Fc=5Hz
        this.xv[0] = this.xv[1]; this.xv[1] = this.xv[2]; this.xv[2] = this.xv[3]; this.xv[3] = this.xv[4];
        this.xv[4] = val / 3.4142; // GAIN

        this.yv[0] = this.yv[1]; this.yv[1] = this.yv[2]; this.yv[2] = this.yv[3]; this.yv[3] = this.yv[4];

        this.yv[4] = (this.xv[0] + this.xv[4]) + 4 * (this.xv[1] + this.xv[3]) + 6 * this.xv[2]
            + (-0.0000000000 * this.yv[0]) + (0.0000000000 * this.yv[1])
            + (-0.1715728753 * this.yv[2]) + (0.0000000000 * this.yv[3]);

        return this.yv[4];
    }
}

// 4. Trapezoidal Integration & ZUPT (Zero Velocity Update)
export class VelocityIntegrator {
    private currentVelocity = 0;
    private prevAccel = 0;
    private dt = 0.050; // 50ms step for 20Hz sampling rate
    private filter = new ButterworthLowPass();

    private zuptThreshold = 0.15; // m/s^2 
    private zuptCounter = 0;
    private zuptMaxFrames = 4; // 0.2 seconds * 20Hz

    public update(rawZ: number, q: { q0: number, q1: number, q2: number, q3: number }): number {
        // 1. Compensate gravity
        const linearA = getLinearAccelerationBaseZ({ x: 0, y: 0, z: rawZ }, q);

        // 2. Filter impact noise
        const filteredA = this.filter.filter(linearA);

        // 3. Check ZUPT (Zero Velocity Update)
        if (Math.abs(filteredA) < this.zuptThreshold) {
            this.zuptCounter++;
            if (this.zuptCounter >= this.zuptMaxFrames) {
                this.currentVelocity = 0.0;
            }
        } else {
            this.zuptCounter = 0;
        }

        // 4. Trapezoidal Integration (if not resetting via ZUPT)
        if (this.zuptCounter < this.zuptMaxFrames) {
            this.currentVelocity = this.currentVelocity + ((filteredA + this.prevAccel) / 2.0) * this.dt;
        }

        this.prevAccel = filteredA;
        return this.currentVelocity;
    }

    public reset() {
        this.currentVelocity = 0;
        this.prevAccel = 0;
        this.zuptCounter = 0;
    }
}
