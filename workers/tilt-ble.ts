#!/usr/bin/env node
/**
 * Tilt BLE Scanner Worker
 *
 * Standalone process that scans for Tilt Hydrometer BLE iBeacon advertisements
 * and forwards readings to the Remix app via HTTP POST to /API/tilt
 *
 * Requirements:
 * - @stoprocent/noble (or @abandonware/noble)
 * - Bluetooth hardware with BLE support
 * - Linux: user must be in 'bluetooth' group or have CAP_NET_RAW capability
 *
 * Usage:
 *   node workers/tilt-ble.js
 *   # or via systemd (see DEPLOY_PI.md)
 */

import noble from '@stoprocent/noble';
import { TILT_COLOR_UUIDS, type TiltReading, processTiltReading } from '../app/services/tilt.server';

// Config
const SCAN_INTERVAL_MS = 5000; // Report every 5 seconds per Tilt
const API_URL = process.env.API_URL || 'http://localhost:8080/API/tilt';
const USE_HTTP_POST = process.env.TILT_USE_HTTP === 'true'; // Set to 'true' to POST to API instead of direct DB

// iBeacon manufacturer data prefix
const IBEACON_MANUFACTURER_ID = 0x004c; // Apple iBeacon

// Track last reading time per color to avoid spamming
const lastReadingTime = new Map<string, number>();

/**
 * Parse iBeacon manufacturer data from Tilt
 *
 * Format (25 bytes):
 * - 0-1: Manufacturer ID (0x004C for Apple)
 * - 2: iBeacon type (0x02)
 * - 3: iBeacon length (0x15 = 21 bytes)
 * - 4-19: UUID (16 bytes) - identifies Tilt color
 * - 20-21: Major (temp in °F for Classic, temp*10 for Pro)
 * - 22-23: Minor (gravity: 1050 for Classic, 10500 for Pro)
 * - 24: TX Power (RSSI calibration, not used)
 */
interface BeaconData {
  uuid: string;
  major: number; // temperature
  minor: number; // gravity
  rssi: number;
  mac: string;
}

function parseIBeacon(manufacturerData: Buffer, rssi: number, mac: string): BeaconData | null {
  if (manufacturerData.length < 25) {
    return null;
  }

  const type = manufacturerData[2];
  const length = manufacturerData[3];

  if (type !== 0x02 || length !== 0x15) {
    return null;
  }

  // Extract UUID (bytes 4-19)
  const uuid = manufacturerData.slice(4, 20).toString('hex');

  // Extract major and minor (big-endian 16-bit integers)
  const major = manufacturerData.readUInt16BE(20);
  const minor = manufacturerData.readUInt16BE(22);

  return { uuid, major, minor, rssi, mac };
}

/**
 * Process a Tilt reading from BLE scan
 */
async function handleTiltReading(beacon: BeaconData) {
  const color = TILT_COLOR_UUIDS[beacon.uuid];
  if (!color) {
    return;
  } // Not a Tilt UUID

  const now = Date.now();
  const lastTime = lastReadingTime.get(color) || 0;

  // Throttle: only report every SCAN_INTERVAL_MS
  if (now - lastTime < SCAN_INTERVAL_MS) {
    return;
  }

  lastReadingTime.set(color, now);

  const reading: TiltReading = {
    color,
    temp: beacon.major, // Already in °F
    gravity: beacon.minor, // Raw value (1050 or 10500)
    rssi: beacon.rssi,
    uid: `${color}${beacon.mac.replace(/:/g, '')}`,
    mac: beacon.mac,
    timestamp: new Date().toISOString(),
  };

  console.log(`[Tilt BLE] ${color}: SG ${beacon.minor}, Temp ${beacon.major}°F, RSSI ${beacon.rssi}dBm`);

  try {
    if (USE_HTTP_POST) {
      // POST to API endpoint (for testing or when worker runs externally)
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([reading]),
      });

      if (!response.ok) {
        console.error(`[Tilt BLE] HTTP POST failed: ${response.status}`);
      }
    } else {
      // Call processTiltReading directly (worker runs in same process as Remix)
      await processTiltReading(reading);
    }
  } catch (error) {
    console.error('[Tilt BLE] Error processing reading:', error);
  }
}

/**
 * Start BLE scanning
 */
type NoblePeripheral = {
  rssi: number;
  address: string;
  advertisement: {
    manufacturerData?: Buffer;
  };
};

function startScanning() {
  console.log('[Tilt BLE] Starting BLE scan for Tilt hydrometers...');

  noble.on('stateChange', (state: string) => {
    console.log(`[Tilt BLE] Bluetooth state: ${state}`);

    if (state === 'poweredOn') {
      // Scan for all devices (we'll filter by manufacturer data)
      noble.startScanning([], true); // allowDuplicates = true for continuous readings
    } else {
      noble.stopScanning();
    }
  });

  noble.on('discover', (peripheral: NoblePeripheral) => {
    const { advertisement, rssi, address } = peripheral;
    const manufacturerData = advertisement.manufacturerData;

    if (!manufacturerData || manufacturerData.length < 25) {
      return;
    }

    // Check if it's an iBeacon (manufacturer ID 0x004C)
    const manufacturerId = manufacturerData.readUInt16LE(0);
    if (manufacturerId !== IBEACON_MANUFACTURER_ID) {
      return;
    }

    const beacon = parseIBeacon(manufacturerData, rssi, address);
    if (beacon && TILT_COLOR_UUIDS[beacon.uuid]) {
      handleTiltReading(beacon);
    }
  });

  noble.on('warning', (message: string) => {
    console.warn('[Tilt BLE] Warning:', message);
  });

  noble.on('scanStart', () => {
    console.log('[Tilt BLE] Scan started. Waiting for Tilt devices...');
  });

  noble.on('scanStop', () => {
    console.log('[Tilt BLE] Scan stopped.');
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('[Tilt BLE] Stopping scan...');
  noble.stopScanning();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[Tilt BLE] Stopping scan...');
  noble.stopScanning();
  process.exit(0);
});

// Start the worker
startScanning();
