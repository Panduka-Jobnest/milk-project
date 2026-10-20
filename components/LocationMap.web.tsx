// components/LocationMap.web.tsx
// react-native-webview doesn't run on web, so use the OpenStreetMap embed iframe.
type Props = { latitude: number; longitude: number };

export default function LocationMap({ latitude, longitude }: Props) {
  const d = 0.005;
  const bbox = [longitude - d, latitude - d, longitude + d, latitude + d].join(',');
  return (
    <iframe
      title="Location map"
      style={{ border: 0, width: '100%', height: '100%' }}
      src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`}
    />
  );
}
