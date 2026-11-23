import type { ReactNode } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, styles } from '../park-reports/ui';

export function DemoPage({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { top } = useSafeAreaInsets();
  return (
    <View style={[page.root, { paddingTop: top }]}>
      <View style={page.header}>
        <View style={page.headerContent}>
          <View style={page.icon}><Ionicons name="leaf-outline" size={21} color={colors.deep} /></View>
          <View>
            <Text accessibilityRole="header" style={page.title}>{title}</Text>
            <Text style={styles.small}>{subtitle}</Text>
          </View>
        </View>
      </View>
      <ScrollView style={styles.flex} contentContainerStyle={page.scroll}>
        <View style={page.content}>{children}</View>
      </ScrollView>
    </View>
  );
}

const page = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerContent: { width: '100%', maxWidth: 570, alignSelf: 'center', paddingHorizontal: 16, minHeight: 67, gap: 11, flexDirection: 'row', alignItems: 'center' },
  icon: { backgroundColor: colors.gold, borderRadius: 12, width: 39, height: 39, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: colors.deep },
  scroll: { alignItems: 'center' },
  content: { width: '100%', maxWidth: 570, padding: 16, gap: 14 },
});
