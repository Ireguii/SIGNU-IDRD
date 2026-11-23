import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { DemoPage } from '../src/features/vive/DemoPage';
import { Button, colors, Panel, styles } from '../src/features/park-reports/ui';

const news = [
  {
    topic: 'Actividad física', title: 'Recorre el Parque Simón Bolívar',
    summary: 'Ideas para caminar y disfrutar sus espacios al aire libre.',
    content: 'Lleva agua, respeta la señalización y usa los senderos habilitados. Si encuentras un tramo deteriorado, puedes indicar el punto y adjuntar una foto desde Reportes.',
  },
  {
    topic: 'Cuidado de parques', title: 'Un parque limpio se disfruta más',
    summary: 'Pequeñas acciones para cuidar los espacios compartidos.',
    content: 'Deposita los residuos en los contenedores disponibles y recoge los de tu mascota. Si encuentras acumulación de basura, describe el lugar y el problema en la categoría Limpieza.',
  },
  {
    topic: 'Accesibilidad', title: 'Ayuda a identificar barreras en los senderos',
    summary: 'Reporta daños que dificulten el paso por rampas y caminos.',
    content: 'Describe dónde está el obstáculo y, si puedes tomarla sin riesgo, adjunta una fotografía. La categoría Senderos y accesibilidad ayuda a identificar ese tipo de novedad.',
  },
] as const;

export default function NewsRoute() {
  const [opened, setOpened] = useState<number | null>(null);

  return (
    <DemoPage title="Noticias" subtitle="Contenido de demostración">
      {news.map((article, index) => (
        <Panel key={article.title}>
          <View style={newsStyle.topic}><Ionicons name="newspaper-outline" color={colors.deep} size={16} /><Text style={newsStyle.label}>{article.topic}</Text></View>
          <Text style={styles.panelTitle} accessibilityRole="header">{article.title}</Text>
          <Text style={styles.body}>{article.summary}</Text>
          {opened === index && <Text style={styles.body}>{article.content}</Text>}
          <Button label={opened === index ? 'Cerrar nota' : 'Leer nota'} variant="outline" onPress={() => setOpened(opened === index ? null : index)} />
        </Panel>
      ))}
    </DemoPage>
  );
}

const newsStyle = StyleSheet.create({
  topic: { alignSelf: 'flex-start', flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: colors.mist, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8 },
  label: { color: colors.deep, fontWeight: '700', fontSize: 12 },
});
