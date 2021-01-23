import { loadFonts }    from 'react-native-dynamic-fonts';
import musicStudioIcons from './music-studio-icons-b64';

export async function loadApplicationFonts() {
  await loadFonts([
    musicStudioIcons
  ]);
}
