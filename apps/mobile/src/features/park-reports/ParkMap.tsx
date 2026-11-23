import { useEffect, useRef } from 'react';
import MapView, { Marker } from 'react-native-maps';
import { StyleSheet, View } from 'react-native';
import { initialPoint } from './api';
import type { ParkMapProps } from './ParkMap.types';

export function ParkMap({ point, onPick }: ParkMapProps) {
  const map = useRef<MapView>(null);
  useEffect(() => {
    if (point) map.current?.animateCamera({ center: point, zoom: 15 });
  }, [point]);

  return (
    <View style={styles.frame}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        accessibilityLabel="Mapa para elegir el punto de la novedad"
        initialRegion={{ ...initialPoint, latitudeDelta: 0.045, longitudeDelta: 0.045 }}
        onPress={(event) => onPick(event.nativeEvent.coordinate)}
        toolbarEnabled={false}
      >
        {point && <Marker coordinate={point} title="Ubicación de la novedad" pinColor="#a61d30" />}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 250, borderRadius: 18, overflow: 'hidden', backgroundColor: '#e7f0eb' },
});
