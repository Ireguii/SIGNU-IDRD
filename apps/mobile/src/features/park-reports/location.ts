import { Platform } from 'react-native';
import * as Location from 'expo-location';
import type { Point } from './api';

type DevicePoint = { point: Point; method: 'gps'; accuracyM?: number };
const manual = 'Puedes tocar el mapa para marcar el lugar.';
const denied = `Permite el acceso a la ubicación en los ajustes del navegador o del dispositivo y vuelve a intentarlo. ${manual}`;
const unavailable = `El dispositivo no pudo determinar su ubicación. Comprueba que la localización esté activada. ${manual}`;

function position(latitude: number, longitude: number, accuracy: number | null): DevicePoint {
  return {
    point: { latitude, longitude },
    method: 'gps',
    accuracyM: accuracy !== null && Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= 100000 ? accuracy : undefined,
  };
}

export async function locateDevice(): Promise<DevicePoint> {
  if (Platform.OS === 'web') {
    if (!globalThis.isSecureContext) {
      throw new Error(`Abre la demo por HTTPS para usar el GPS. ${manual}`);
    }

    const geolocation = navigator.geolocation;
    if (!geolocation) throw new Error(unavailable);

    return new Promise((resolve, reject) => {
      const onPosition: PositionCallback = ({ coords }) => {
        resolve(position(coords.latitude, coords.longitude, coords.accuracy));
      };

      const onError: PositionErrorCallback = ({ code }) => {
        if (code === 1) {
          reject(new Error(denied));
        } else if (code === 3) {
          reject(new Error(`El GPS tardó demasiado. Intenta de nuevo cerca de una ventana. ${manual}`));
        } else {
          reject(new Error(unavailable));
        }
      };

      geolocation.getCurrentPosition(
        onPosition,
        (error) => {
          if (error.code === 2 || error.code === 3) {
            geolocation.getCurrentPosition(onPosition, onError, {
              enableHighAccuracy: false,
              timeout: 10000,
              maximumAge: 0,
            });
            return;
          }

          onError(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        },
      );
    });
  }

  if (!(await Location.requestForegroundPermissionsAsync()).granted) throw new Error(denied);
  if (!(await Location.hasServicesEnabledAsync())) throw new Error(unavailable);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const recent = await Location.getLastKnownPositionAsync({ maxAge: 30000, requiredAccuracy: 80 }).catch(() => null);
    const result = recent ?? await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => { throw new Error(unavailable); }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`El GPS tardó demasiado. Inténtalo de nuevo. ${manual}`)), 25000);
      }),
    ]);
    return position(result.coords.latitude, result.coords.longitude, result.coords.accuracy);
  } finally {
    clearTimeout(timer);
  }
}
