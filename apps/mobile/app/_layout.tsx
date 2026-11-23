import { useEffect, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, Text, View } from 'react-native';
import { colors } from '../src/features/park-reports/ui';

export default function RootLayout() {
  const [ready, setReady] = useState(Platform.OS !== 'web');
  useEffect(() => { setReady(true); }, []);

  if (!ready) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
      <Text style={{ color: colors.deep, fontWeight: '700' }}>Cargando Vive IDRD…</Text>
    </View>;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Tabs screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarActiveBackgroundColor: colors.mist,
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.border,
          ...(Platform.OS === 'web' ? { height: 60, paddingBottom: 5 } : {}) },
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: { fontWeight: '700', fontSize: 12 },
        sceneStyle: { backgroundColor: colors.paper },
      }}>
        <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarAccessibilityLabel: 'Inicio', tabBarButtonTestID: 'tab-inicio', tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} /> }} />
        <Tabs.Screen name="noticias" options={{ title: 'Noticias', tabBarAccessibilityLabel: 'Noticias', tabBarButtonTestID: 'tab-noticias', tabBarIcon: ({ color, size }) => <Ionicons name="newspaper-outline" color={color} size={size} /> }} />
        <Tabs.Screen name="reportar-novedad" options={{ title: 'Reportes', tabBarAccessibilityLabel: 'Reportes', tabBarButtonTestID: 'tab-reportes', tabBarIcon: ({ color, size }) => <Ionicons name="clipboard-outline" color={color} size={size} /> }} />
      </Tabs>
    </>
  );
}
