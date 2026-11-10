// components/LocationMap.web.tsx
// react-native-webview doesn't run on web, so render the Google Maps embed iframe directly.
type Props = { latitude: number; longitude: number };

export default function LocationMap({ latitude, longitude }: Props) {
  return (
    <iframe
      title="Location map"
      style={{ border: 0, width: '100%', height: '100%' }}
      src={`https://maps.google.com/maps?q=${latitude},${longitude}&z=16&output=embed`}
      allowFullScreen
    />
  );
}
