// components/LocationMap.tsx
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

type Props = { latitude: number; longitude: number };

// Google Maps embed: no API key needed.
export function googleMapsEmbedUrl(lat: number, lng: number) {
  return `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
}

function buildHtml(lat: number, lng: number) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>
    html, body { height: 100%; margin: 0; background: #e5e3df; }
    iframe { border: 0; width: 100%; height: 100%; display: block; }
  </style>
</head>
<body>
  <iframe id="map" src="${googleMapsEmbedUrl(lat, lng)}" allowfullscreen
          onload="window.ReactNativeWebView.postMessage('Map loaded')"></iframe>
  <script>
    window.updatePosition = function (url) {
      var frame = document.getElementById('map');
      if (frame.src !== url) frame.src = url;
    };
  </script>
</body>
</html>`;
}

export default function LocationMap({ latitude, longitude }: Props) {
  const webRef = useRef<WebView>(null);
  // Build the page once; later position changes only swap the iframe URL.
  const [html] = useState(() => buildHtml(latitude, longitude));

  useEffect(() => {
    const url = JSON.stringify(googleMapsEmbedUrl(latitude, longitude));
    webRef.current?.injectJavaScript(
      `window.updatePosition && window.updatePosition(${url}); true;`
    );
  }, [latitude, longitude]);

  return (
    <WebView
      ref={webRef}
      style={styles.map}
      containerStyle={styles.container}
      originWhitelist={['*']}
      source={{ html, baseUrl: 'https://tempapp.local/' }}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      nestedScrollEnabled
      // Keep taps inside the map instead of opening the browser / Maps app.
      setSupportMultipleWindows={false}
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
