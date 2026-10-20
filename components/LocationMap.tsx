// components/LocationMap.tsx
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

type Props = { latitude: number; longitude: number };

// Leaflet + OpenStreetMap tiles: no API key needed.
function buildHtml(lat: number, lng: number) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; background: #e5e3df; }
    #status { position: absolute; top: 45%; width: 100%; text-align: center; font: 14px sans-serif; color: #555; }
  </style>
</head>
<body>
  <div id="status">Loading map...</div>
  <div id="map"></div>
  <script>
    function report(msg) {
      document.getElementById('status').textContent = msg;
      window.ReactNativeWebView.postMessage(msg);
    }
    window.onerror = function (msg) { report('Map error: ' + msg); };
  </script>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
          onerror="report('Could not download map library (check internet)')"></script>
  <script>
    if (window.L) {
      document.getElementById('status').remove();
      var map = L.map('map', { zoomControl: true }).setView([${lat}, ${lng}], 15);
      var tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);
      tiles.on('tileerror', function () { window.ReactNativeWebView.postMessage('Map tile failed to load'); });
      var marker = L.marker([${lat}, ${lng}]).addTo(map);
      window.updatePosition = function (lat, lng) {
        marker.setLatLng([lat, lng]);
        map.panTo([lat, lng]);
      };
      // The WebView may get its final size after the map is created.
      setTimeout(function () { map.invalidateSize(); }, 300);
      window.ReactNativeWebView.postMessage('Map loaded');
    }
  </script>
</body>
</html>`;
}

export default function LocationMap({ latitude, longitude }: Props) {
  const webRef = useRef<WebView>(null);
  // Build the page once; later position changes move the marker without reloading.
  const [html] = useState(() => buildHtml(latitude, longitude));

  useEffect(() => {
    webRef.current?.injectJavaScript(
      `window.updatePosition && window.updatePosition(${latitude}, ${longitude}); true;`
    );
  }, [latitude, longitude]);

  return (
    <WebView
      ref={webRef}
      style={styles.map}
      containerStyle={styles.container}
      originWhitelist={['*']}
      // A real baseUrl gives tile requests a Referer; OSM blocks requests without one.
      source={{ html, baseUrl: 'https://tempapp.local/' }}
      javaScriptEnabled
      domStorageEnabled
      mixedContentMode="always"
      scrollEnabled={false}
      nestedScrollEnabled
      onMessage={(e) => console.log('🗺️', e.nativeEvent.data)}
      onError={(e) => console.log('🗺️ WebView error:', e.nativeEvent.description)}
      onHttpError={(e) => console.log('🗺️ WebView HTTP error:', e.nativeEvent.statusCode)}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', alignSelf: 'stretch' },
  // opacity 0.99 works around Android WebViews rendering blank inside rounded, overflow-hidden parents.
  map: { flex: 1, opacity: 0.99 },
});
