import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Mapbox from '@rnmapbox/maps';

const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
const hasCustomMapboxToken = Boolean(mapboxToken && !mapboxToken.includes('example') && mapboxToken.startsWith('pk.'));

if (hasCustomMapboxToken && mapboxToken) {
  Mapbox.setAccessToken(mapboxToken);
}

// Open-source tokenless dark vector style fallback (Carto Dark Matter)
const DEFAULT_DARK_STYLE = hasCustomMapboxToken
  ? Mapbox.StyleURL.Dark
  : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

interface ActivityMapProps {
  coordinates: { latitude: number; longitude: number }[];
  isLive?: boolean;
  userLocation?: { latitude: number; longitude: number; heading?: number | null } | null;
  onRecenter?: () => void;
  style?: object;
  interactive?: boolean;
}

export function ActivityMap({
  coordinates,
  isLive = false,
  userLocation,
  style,
  interactive = true,
}: ActivityMapProps) {
  const cameraRef = useRef<Mapbox.Camera>(null);

  const geoJsonCoordinates: [number, number][] = coordinates.map((c) => [c.longitude, c.latitude]);

  const routeGeoJSON: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: geoJsonCoordinates,
        },
      },
    ],
  };

  const startPoint = geoJsonCoordinates[0];
  const endPoint = geoJsonCoordinates[geoJsonCoordinates.length - 1];

  const recenter = () => {
    if (isLive && userLocation && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [userLocation.longitude, userLocation.latitude],
        zoomLevel: 16,
        animationDuration: 1000,
      });
    } else if (geoJsonCoordinates.length > 0 && cameraRef.current) {
      // Fit bounds to the whole route
      const lats = geoJsonCoordinates.map((c) => c[1]);
      const lngs = geoJsonCoordinates.map((c) => c[0]);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      cameraRef.current.fitBounds(
        [maxLng, maxLat],
        [minLng, minLat],
        [40, 40, 40, 40],
        1000
      );
    }
  };

  useEffect(() => {
    if (isLive && userLocation && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [userLocation.longitude, userLocation.latitude],
        zoomLevel: 16,
        animationDuration: 500,
      });
    }
  }, [isLive, userLocation?.latitude, userLocation?.longitude]);

  return (
    <View style={[styles.container, style]}>
      <Mapbox.MapView
        style={styles.map}
        styleURL={DEFAULT_DARK_STYLE}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
        scrollEnabled={interactive}
        pitchEnabled={interactive}
        rotateEnabled={interactive}
        zoomEnabled={interactive}
      >
        <Mapbox.Camera
          ref={cameraRef}
          followUserLocation={isLive}
          followZoomLevel={16}
          defaultSettings={{
            centerCoordinate: userLocation
              ? [userLocation.longitude, userLocation.latitude]
              : startPoint || undefined,
            zoomLevel: 16,
          }}
        />

        {/* Live User Location Puck */}
        {isLive && (
          <Mapbox.UserLocation
            visible={true}
            showsUserHeadingIndicator={true}
            minDisplacement={1}
            androidRenderMode="gps"
          />
        )}

        {/* Drawn Route Polyline */}
        {geoJsonCoordinates.length > 1 && (
          <Mapbox.ShapeSource id="routeSource" shape={routeGeoJSON}>
            <Mapbox.LineLayer
              id="routeOutline"
              style={{
                lineColor: '#FFFFFF',
                lineWidth: 6,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: 0.3,
              }}
            />
            <Mapbox.LineLayer
              id="routeLine"
              style={{
                lineColor: '#E63946',
                lineWidth: 4,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* Start Point Marker */}
        {startPoint && (
          <Mapbox.PointAnnotation id="startPoint" coordinate={startPoint}>
            <View style={styles.startMarker}>
              <Ionicons name="flag" size={12} color="#FFFFFF" />
            </View>
          </Mapbox.PointAnnotation>
        )}

        {/* End Point Marker (when not live) */}
        {!isLive && endPoint && (
          <Mapbox.PointAnnotation id="endPoint" coordinate={endPoint}>
            <View style={styles.endMarker}>
              <Ionicons name="checkmark-sharp" size={12} color="#FFFFFF" />
            </View>
          </Mapbox.PointAnnotation>
        )}
      </Mapbox.MapView>

      {/* Recenter Button */}
      {interactive && (
        <TouchableOpacity
          style={styles.recenterBtn}
          activeOpacity={0.8}
          onPress={recenter}
        >
          <Ionicons name="locate" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#121212',
  },
  map: {
    flex: 1,
  },
  startMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  endMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E63946',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  recenterBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3A3A3C',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});
