import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { DemoPage } from '../src/features/vive/DemoPage';
import { Button, colors, Panel, styles } from '../src/features/park-reports/ui';

const cover = require('../assets/parque-simon-bolivar.jpg');

export default function HomeRoute() {
  const router = useRouter();

  return (
    <DemoPage title="Vive IDRD" subtitle="Demostración">
      <ImageBackground source={cover} style={home.hero} imageStyle={home.image} resizeMode="cover">
        <View style={home.overlay}>
          <Text style={home.place}>PARQUE SIMÓN BOLÍVAR · BOGOTÁ</Text>
          <Text accessibilityRole="header" style={home.title}>Disfruta los parques de Bogotá</Text>
        </View>
      </ImageBackground>
      <Text style={styles.small}>Foto: Jairo1005 · CC BY-SA 4.0</Text>
      <Panel title="Cuidemos nuestros parques" subtitle="Reporta daños en juegos, luminarias, senderos y otros espacios del parque.">
        <Button label="Ir a Reportes" onPress={() => router.navigate('/reportar-novedad')} />
      </Panel>
      <Panel title="Noticias" subtitle="Encuentra información sobre el uso y cuidado de los parques.">
        <Button label="Ver noticias" variant="outline" icon={<Ionicons name="newspaper-outline" color={colors.brand} size={18} />} onPress={() => router.navigate('./noticias')} />
      </Panel>
    </DemoPage>
  );
}

const home = StyleSheet.create({
  hero: { minHeight: 290, borderRadius: 20, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: colors.deep },
  image: { borderRadius: 20 },
  overlay: { padding: 20, gap: 6, backgroundColor: 'rgba(80,17,30,0.92)', borderBottomWidth: 5, borderBottomColor: colors.gold },
  place: { color: colors.gold, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  title: { color: colors.white, fontSize: 34, lineHeight: 38, fontWeight: '800', letterSpacing: -1 },
});
