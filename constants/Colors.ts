// Brand palette sampled from the Miltrix logo
export const Brand = {
  skyBlue: '#0192F6', // top of the "M"
  royalBlue: '#014AAC', // middle of the "M"
  navy: '#023C94', // bottom of the "M"
  green: '#1D9C01', // Wi-Fi waves
  lime: '#6BDC01', // bright end of the swoosh
  ice: '#A0E2FB', // milk droplet highlight
  black: '#000000', // logo background
};

export default {
  light: {
    text: '#0A1628',
    textMuted: '#5B6B82',
    background: '#F2F6FB',
    card: '#FFFFFF',
    border: '#D9E3F0',
    tint: Brand.royalBlue,
    primary: Brand.royalBlue,
    onPrimary: '#FFFFFF',
    primarySoft: '#E3EEFB',
    success: '#167F00',
    successSoft: '#E6F6DF',
    danger: '#D62839',
    dangerSoft: '#FDE7E9',
    inputBackground: '#FFFFFF',
    placeholder: '#8A9AB0',
    tabIconDefault: '#8A9AB0',
    tabIconSelected: Brand.royalBlue,
  },
  dark: {
    text: '#F2F6FC',
    textMuted: '#8C9DB8',
    background: Brand.black,
    card: '#0A1424',
    border: '#1A2B47',
    tint: Brand.skyBlue,
    primary: '#0A6FDB',
    onPrimary: '#FFFFFF',
    primarySoft: '#0C2240',
    success: Brand.lime,
    successSoft: '#11260A',
    danger: '#FF5C6C',
    dangerSoft: '#2E0F14',
    inputBackground: '#0E1A2E',
    placeholder: '#5F7290',
    tabIconDefault: '#5F7290',
    tabIconSelected: Brand.skyBlue,
  },
};
