import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutChangeEvent,
} from 'react-native';
import Svg, {
  Path,
  Circle,
  G,
  Line,
  Defs,
  LinearGradient,
  Stop,
  RadialGradient,
  Rect,
} from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface ActivityMapProps {
  coordinates: Coordinate[];
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
  const [dimensions, setDimensions] = useState({ width: 340, height: 320 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setDimensions({ width, height });
    }
  };

  const handleZoomIn = () => {
    setZoomLevel((z) => Math.min(z * 1.35, 4));
  };

  const handleZoomOut = () => {
    setZoomLevel((z) => Math.max(z / 1.35, 0.5));
  };

  const handleRecenter = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Compute all points to frame (coordinates + live location)
  const allPoints = useMemo(() => {
    const pts = [...coordinates];
    if (userLocation && !pts.some((p) => p.latitude === userLocation.latitude && p.longitude === userLocation.longitude)) {
      pts.push({ latitude: userLocation.latitude, longitude: userLocation.longitude });
    }
    return pts;
  }, [coordinates, userLocation]);

  // Project lat/lon to 2D SVG canvas coordinates
  const { pathString, projectedPoints, projectedUser, centerCoord } = useMemo(() => {
    const { width, height } = dimensions;
    const padding = 44;
    const drawW = Math.max(width - padding * 2, 50);
    const drawH = Math.max(height - padding * 2, 50);

    if (allPoints.length === 0) {
      const cx = width / 2;
      const cy = height / 2;
      return {
        pathString: '',
        projectedPoints: [],
        projectedUser: userLocation ? { x: cx, y: cy } : null,
        centerCoord: userLocation ? { lat: userLocation.latitude, lon: userLocation.longitude } : null,
      };
    }

    const lats = allPoints.map((p) => p.latitude);
    const lons = allPoints.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    const midLat = (minLat + maxLat) / 2;
    const midLon = (minLon + maxLon) / 2;

    // Minimum bounding span to avoid divide by zero when standing still
    const latSpan = Math.max(maxLat - minLat, 0.0012);
    // Adjust longitude span for latitude distortion
    const cosLat = Math.cos((midLat * Math.PI) / 180);
    const lonSpan = Math.max((maxLon - minLon) * cosLat, 0.0012);

    const scale = Math.min(drawW / lonSpan, drawH / latSpan) * zoomLevel;

    const project = (lat: number, lon: number) => {
      const x = width / 2 + (lon - midLon) * cosLat * scale + panOffset.x;
      const y = height / 2 - (lat - midLat) * scale + panOffset.y;
      return { x, y };
    };

    const projPoints = coordinates.map((c) => project(c.latitude, c.longitude));

    let path = '';
    if (projPoints.length > 0) {
      path = `M ${projPoints[0].x.toFixed(1)} ${projPoints[0].y.toFixed(1)}`;
      for (let i = 1; i < projPoints.length; i++) {
        path += ` L ${projPoints[i].x.toFixed(1)} ${projPoints[i].y.toFixed(1)}`;
      }
    }

    const projUser = userLocation
      ? project(userLocation.latitude, userLocation.longitude)
      : projPoints[projPoints.length - 1] || null;

    return {
      pathString: path,
      projectedPoints: projPoints,
      projectedUser: projUser,
      centerCoord: { lat: midLat, lon: midLon },
    };
  }, [allPoints, coordinates, userLocation, dimensions, zoomLevel, panOffset]);

  const startPoint = projectedPoints[0];
  const endPoint = projectedPoints[projectedPoints.length - 1];

  const currentLat = userLocation?.latitude ?? coordinates[coordinates.length - 1]?.latitude;
  const currentLon = userLocation?.longitude ?? coordinates[coordinates.length - 1]?.longitude;

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      <Svg width={dimensions.width} height={dimensions.height} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Neon Route Trail Gradient */}
          <LinearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#38BDF8" stopOpacity="0.9" />
            <Stop offset="50%" stopColor="#E63946" stopOpacity="1" />
            <Stop offset="100%" stopColor="#FACC15" stopOpacity="1" />
          </LinearGradient>

          {/* Radar Background Glow */}
          <RadialGradient id="radarGlow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor="#E63946" stopOpacity="0.08" />
            <Stop offset="60%" stopColor="#1E293B" stopOpacity="0.03" />
            <Stop offset="100%" stopColor="#0A0A0C" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Deep Obsidian Map Canvas */}
        <Rect x="0" y="0" width={dimensions.width} height={dimensions.height} fill="#0A0A0C" />
        <Rect x="0" y="0" width={dimensions.width} height={dimensions.height} fill="url(#radarGlow)" />

        {/* Tactical Grid & Radar Concentric Range Rings */}
        <G opacity={0.28}>
          {/* Concentric distance circles centered at screen */}
          <Circle
            cx={dimensions.width / 2}
            cy={dimensions.height / 2}
            r={50 * zoomLevel}
            stroke="#2A2A30"
            strokeWidth="1"
            strokeDasharray="4 4"
            fill="none"
          />
          <Circle
            cx={dimensions.width / 2}
            cy={dimensions.height / 2}
            r={110 * zoomLevel}
            stroke="#2A2A30"
            strokeWidth="1"
            strokeDasharray="4 4"
            fill="none"
          />
          <Circle
            cx={dimensions.width / 2}
            cy={dimensions.height / 2}
            r={180 * zoomLevel}
            stroke="#202026"
            strokeWidth="1"
            strokeDasharray="6 6"
            fill="none"
          />

          {/* Crosshair Axes */}
          <Line
            x1="0"
            y1={dimensions.height / 2}
            x2={dimensions.width}
            y2={dimensions.height / 2}
            stroke="#1F1F24"
            strokeWidth="1"
          />
          <Line
            x1={dimensions.width / 2}
            y1="0"
            x2={dimensions.width / 2}
            y2={dimensions.height}
            stroke="#1F1F24"
            strokeWidth="1"
          />
        </G>

        {/* Outer Trail Glow (Soft bloom) */}
        {pathString ? (
          <Path
            d={pathString}
            stroke="#E63946"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.25"
            fill="none"
          />
        ) : null}

        {/* Main Sharp Trail Polyline */}
        {pathString ? (
          <Path
            d={pathString}
            stroke="url(#routeGradient)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : null}

        {/* Start Point Marker */}
        {startPoint && (
          <G>
            <Circle cx={startPoint.x} cy={startPoint.y} r="9" fill="#22C55E" opacity={0.3} />
            <Circle cx={startPoint.x} cy={startPoint.y} r="5" fill="#22C55E" stroke="#FFFFFF" strokeWidth="2" />
          </G>
        )}

        {/* Finished End Marker (When not live and completed) */}
        {!isLive && endPoint && coordinates.length > 1 && (
          <G>
            <Circle cx={endPoint.x} cy={endPoint.y} r="9" fill="#E63946" opacity={0.3} />
            <Circle cx={endPoint.x} cy={endPoint.y} r="5" fill="#E63946" stroke="#FFFFFF" strokeWidth="2" />
          </G>
        )}

        {/* Live Active Location Puck with Pulse Halo */}
        {isLive && projectedUser && (
          <G>
            {/* Pulsing Beacon Halo */}
            <Circle cx={projectedUser.x} cy={projectedUser.y} r="22" fill="#38BDF8" opacity={0.18} />
            <Circle cx={projectedUser.x} cy={projectedUser.y} r="13" fill="#38BDF8" opacity={0.35} />

            {/* Inner Core */}
            <Circle
              cx={projectedUser.x}
              cy={projectedUser.y}
              r="6.5"
              fill="#38BDF8"
              stroke="#FFFFFF"
              strokeWidth="2.5"
            />
          </G>
        )}
      </Svg>

      {/* Top Left GPS Telemetry Badge */}
      <View style={styles.telemetryBadge}>
        <View style={styles.livePulseDot} />
        <Text style={styles.telemetryText}>
          {currentLat != null && currentLon != null
            ? `${Math.abs(currentLat).toFixed(4)}°${currentLat >= 0 ? 'N' : 'S'}, ${Math.abs(currentLon).toFixed(4)}°${currentLon >= 0 ? 'E' : 'W'}`
            : isLive
            ? 'Acquiring GPS…'
            : 'Route Overview'}
        </Text>
      </View>

      {/* Cardinal Direction Indicator (Compass North) */}
      <View style={styles.compassIndicator}>
        <Text style={styles.compassNorthText}>N</Text>
        <Ionicons name="arrow-up" size={10} color="#E63946" />
      </View>

      {/* Interactive Map HUD Controls (Zoom + / -, Recenter) */}
      {interactive && (
        <View style={styles.controlsGroup}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.hudControlBtn}
            onPress={handleZoomIn}
            accessibilityLabel="Zoom in"
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.hudControlBtn}
            onPress={handleZoomOut}
            accessibilityLabel="Zoom out"
          >
            <Ionicons name="remove" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.hudControlBtn, { marginTop: 4, backgroundColor: 'rgba(230, 57, 70, 0.25)' }]}
            onPress={handleRecenter}
            accessibilityLabel="Recenter map"
          >
            <Ionicons name="locate" size={16} color="#E63946" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
    overflow: 'hidden',
    position: 'relative',
  },
  telemetryBadge: {
    position: 'absolute',
    top: 70,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 18, 22, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2C2C32',
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
    marginRight: 6,
  },
  telemetryText: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 0.3,
  },
  compassIndicator: {
    position: 'absolute',
    top: 70,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(18, 18, 22, 0.88)',
    borderWidth: 1,
    borderColor: '#2C2C32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassNorthText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
    lineHeight: 9,
  },
  controlsGroup: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'column',
    gap: 6,
  },
  hudControlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(28, 28, 32, 0.9)',
    borderWidth: 1,
    borderColor: '#3A3A42',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 3,
  },
});
