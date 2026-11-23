import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  ImageBackground,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import {
  createReportsApi,
  getDefaultApiUrl,
  officialPqrs,
  readableError,
  type Category,
  type CategoryId,
  type Report,
} from './api';
import { ReportForm } from './ReportForm';
import { formatReportDate, reportStatuses, reportStatusMessages } from './status';
import { Button, colors, Field, Notice, Panel, styles } from './ui';

type Screen = 'home' | 'form' | 'confirmation' | 'lookup' | 'tracking';

const icons = {
  lighting: 'bulb-outline',
  water: 'water-outline',
  play: 'game-controller-outline',
  cleaning: 'trash-outline',
  paths: 'walk-outline',
  other: 'help-circle-outline',
} as const satisfies Record<CategoryId, keyof typeof Ionicons.glyphMap>;

const cover = require('../../../assets/parque-simon-bolivar.jpg');

export type ParkReportsModuleProps = {
  apiUrl?: string;
  onExit?: () => void;
};

export function ParkReportsModule({
  apiUrl = getDefaultApiUrl(),
  onExit,
}: ParkReportsModuleProps) {
  const api = useMemo(() => createReportsApi(apiUrl), [apiUrl]);
  const [screen, setScreen] = useState<Screen>('home');
  const [initialCategory, setInitialCategory] = useState<CategoryId | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryError, setCategoryError] = useState('');
  const [revision, setRevision] = useState(0);
  const [receipt, setReceipt] = useState<{ report: Report; key: string } | null>(null);
  const [tracked, setTracked] = useState<{ report: Report; key: string } | null>(null);
  const [trackingError, setTrackingError] = useState('');
  const [trackingBusy, setTrackingBusy] = useState(false);
  const updatingTracking = useRef(false);
  const [formBusy, setFormBusy] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'unavailable'>('idle');
  const [linkError, setLinkError] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const { top, bottom } = useSafeAreaInsets();

  useEffect(() => {
    let active = true;
    setCategoryError('');

    void api.categories().then((values) => {
      if (active) setCategories(values);
    }).catch((error) => {
      if (active) setCategoryError(readableError(error));
    });

    return () => { active = false; };
  }, [api, revision]);

  useEffect(() => {
    scroller.current?.scrollTo({ y: 0, animated: false });
  }, [screen]);

  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android' || screen === 'home') return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!formBusy) setScreen(screen === 'tracking' ? 'lookup' : 'home');
      return true;
    });

    return () => subscription.remove();
  }, [formBusy, screen]));

  async function refreshTracking(target: { report: Report; key: string }) {
    if (updatingTracking.current) return;

    updatingTracking.current = true;
    setTrackingBusy(true);
    setTrackingError('');

    try {
      const report = await api.lookup(target.report.reference, target.key);
      setTracked((current) =>
        current?.report.reference === report.reference && current.key === target.key
          ? { report, key: target.key }
          : current
      );
    } catch (error) {
      setTrackingError(readableError(error));
    } finally {
      updatingTracking.current = false;
      setTrackingBusy(false);
    }
  }

  function openTracking(report: Report, key: string) {
    setTracked({ report, key });
    setTrackingError('');
    setScreen('tracking');
  }

  function startReport(category: CategoryId | null = null) {
    setInitialCategory(category);
    setScreen('form');
  }

  function goBack() {
    if (screen === 'home') onExit?.();
    else setScreen(screen === 'tracking' ? 'lookup' : 'home');
  }

  function openLink(url: string) {
    setLinkError(false);
    void Linking.openURL(url).catch(() => setLinkError(true));
  }

  async function copyReceipt() {
    if (!receipt) return;

    try {
      const copied = await Clipboard.setStringAsync(`${receipt.report.reference}\n${receipt.key}`);
      setCopyStatus(copied ? 'copied' : 'unavailable');
    } catch {
      setCopyStatus('unavailable');
    }
  }

  return (
    <View style={[layout.root, { paddingTop: top }]}>
      <View style={layout.header}>
        <View style={layout.headerContent}>
          {(screen !== 'home' || onExit) && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Volver"
              onPress={goBack}
              disabled={formBusy}
              accessibilityState={{ disabled: formBusy }}
              style={layout.back}
            >
              <Ionicons name="arrow-back" size={21} color={colors.deep} />
            </Pressable>
          )}
          <View style={layout.brandIcon}>
            <Ionicons name="leaf-outline" size={21} color={colors.deep} />
          </View>
          <View style={styles.flex}>
            <Text style={layout.brand}>Cuidemos nuestros parques</Text>
            <Text style={styles.small}>Módulo propuesto para Vive IDRD</Text>
          </View>
        </View>
      </View>

      <ScrollView ref={scroller} keyboardShouldPersistTaps="handled" style={styles.flex}>
        <View style={[layout.content, { paddingBottom: Math.max(bottom, 24) + 16 }]}>
          {screen === 'home' && (
            <>
              <ImageBackground source={cover} resizeMode="cover" style={layout.hero} imageStyle={layout.heroImage}>
                <View style={layout.heroOverlay}>
                  <View style={layout.heroBadge}>
                    <Ionicons name="location-outline" size={14} color={colors.gold} />
                    <Text style={layout.heroTag}>Bogotá D. C.</Text>
                  </View>
                  <Text accessibilityRole="header" style={layout.heroTitle}>Reporta una novedad en tu parque</Text>
                  <Text style={layout.heroText}>
                    Cuéntanos qué pasó y dónde. Puedes enviar el reporte sin crear una cuenta.
                  </Text>
                </View>
              </ImageBackground>

              <Text style={layout.credit}>Parque Simón Bolívar · Jairo1005 · CC BY-SA 4.0</Text>
              <Button label="Crear un nuevo reporte" onPress={() => startReport()} />
              <Button
                label="Consultar reporte"
                onPress={() => setScreen('lookup')}
                variant="outline"
                icon={<Ionicons name="search-outline" size={17} color={colors.brand} />}
              />

              <Text style={layout.sectionTitle} accessibilityRole="header">¿Qué puedes reportar?</Text>
              <View style={layout.grid}>
                {categories.map(({ id, label, hint }) => (
                  <Pressable
                    key={id}
                    accessibilityRole="button"
                    accessibilityLabel={`Crear reporte de ${label}`}
                    onPress={() => startReport(id)}
                    style={({ pressed }) => [layout.category, pressed && styles.pressed]}
                  >
                    <Ionicons name={icons[id]} size={21} color={colors.brand} />
                    <Text style={styles.label}>{label}</Text>
                    <Text style={styles.small}>{hint}</Text>
                  </Pressable>
                ))}
              </View>

              {categoryError ? (
                <Panel>
                  <Notice tone="error">{categoryError}</Notice>
                  <Button label="Reintentar conexión" variant="outline" onPress={() => setRevision(revision + 1)} />
                </Panel>
              ) : null}
              <Notice>Esta demostración guarda reportes de prueba. Para radicar una solicitud formal, usa el canal oficial de PQRSD.</Notice>
              <Button
                label="Ir a PQRSD oficial"
                variant="text"
                icon={<Ionicons name="open-outline" size={17} color={colors.brand} />}
                onPress={() => openLink(officialPqrs)}
              />
            </>
          )}

          {screen === 'form' && (
            <>
              <PageTitle title="Nuevo reporte ciudadano" description="Ubica el lugar, describe el daño y revisa la información." />
              {categoryError ? (
                <Panel>
                  <Notice tone="error">{categoryError}</Notice>
                  <Button label="Reintentar conexión" variant="outline" onPress={() => setRevision(revision + 1)} />
                </Panel>
              ) : null}
              <ReportForm
                api={api}
                categories={categories}
                initialCategory={initialCategory}
                onBusyChange={setFormBusy}
                onCreated={(report, key) => {
                  setReceipt({ report, key });
                  setCopyStatus('idle');
                  setScreen('confirmation');
                }}
              />
            </>
          )}

          {screen === 'confirmation' && receipt && (
            <>
              <View style={layout.success}>
                <Ionicons name="checkmark" color={colors.green} size={27} />
              </View>
              <PageTitle title="Reporte recibido" description="Guarda la referencia y la clave privada para consultar el estado." />
              <Panel title="Referencia de demostración">
                <Text selectable style={layout.reference}>{receipt.report.reference}</Text>
                <Text style={styles.label}>Clave privada de consulta</Text>
                <Text selectable style={layout.key}>{receipt.key}</Text>
                <Button
                  label={copyStatus === 'copied' ? 'Datos copiados' : 'Copiar referencia y clave'}
                  variant="outline"
                  icon={<Ionicons name="copy-outline" size={17} color={colors.brand} />}
                  onPress={() => void copyReceipt()}
                />
                {copyStatus === 'unavailable' && (
                  <Notice>Selecciona el texto de la referencia y la clave para copiarlos manualmente.</Notice>
                )}
              </Panel>
              <Button
                label="Ver seguimiento"
                onPress={() => {
                  openTracking(receipt.report, receipt.key);
                  void refreshTracking(receipt);
                }}
              />
              <Button label="Volver al inicio" onPress={() => setScreen('home')} variant="text" />
            </>
          )}

          {screen === 'lookup' && (
            <>
              <PageTitle title="Consultar reporte" description="Usa los dos datos que recibiste al enviar el reporte." />
              <LookupForm api={api} initial={receipt} onFound={openTracking} />
            </>
          )}

          {screen === 'tracking' && tracked && (
            <>
              <PageTitle title="Estado de tu reporte" description="Consulta la información registrada en la demostración." />
              <Panel>
                <Text style={layout.reference}>{tracked.report.reference}</Text>
                <Text style={styles.label}>
                  {categories.find((item) => item.id === tracked.report.category)?.label ?? 'Novedad de mantenimiento'}
                </Text>
                <Text style={styles.body}>
                  {[tracked.report.parkName, tracked.report.locality].filter(Boolean).join(' · ') || 'Parque sin identificar'}
                </Text>
                <Text style={styles.small}>Actualizado {formatReportDate(tracked.report.updatedAt)}</Text>
              </Panel>
              <Panel title={reportStatuses[tracked.report.status]}>
                <Text style={styles.body}>{reportStatusMessages[tracked.report.status]}</Text>
                <Button
                  label="Actualizar estado"
                  variant="outline"
                  busy={trackingBusy}
                  onPress={() => void refreshTracking(tracked)}
                />
                {trackingError ? <Notice tone="error">{trackingError}</Notice> : null}
              </Panel>
              <Panel title="Historial">
                {[...tracked.report.history].reverse().map((event) => (
                  <View key={event.version} style={layout.historyEvent}>
                    <Ionicons name="ellipse" color={colors.brand} size={11} />
                    <View style={styles.flex}>
                      <Text style={styles.label}>{reportStatuses[event.status]}</Text>
                      <Text style={styles.small}>{formatReportDate(event.at)}</Text>
                      {event.publicNote ? <Text style={styles.body}>{event.publicNote}</Text> : null}
                    </View>
                  </View>
                ))}
              </Panel>
              <Button label="Consultar otro reporte" variant="outline" onPress={() => setScreen('lookup')} />
              <Button
                label="Ir a PQRSD oficial"
                variant="text"
                icon={<Ionicons name="open-outline" size={17} color={colors.brand} />}
                onPress={() => openLink(officialPqrs)}
              />
            </>
          )}

          {linkError && <Notice tone="error">No se pudo abrir el enlace externo.</Notice>}
        </View>
      </ScrollView>
    </View>
  );
}

function LookupForm({ api, initial, onFound }: {
  api: ReturnType<typeof createReportsApi>;
  initial: { report: Report; key: string } | null;
  onFound: (report: Report, key: string) => void;
}) {
  const [reference, setReference] = useState(initial?.report.reference ?? '');
  const [key, setKey] = useState(initial?.key ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function lookup() {
    if (busy) return;

    if (!reference.trim() || !key.trim()) {
      setError('Ingresa la referencia y la clave privada.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      onFound(await api.lookup(reference.trim(), key.trim()), key.trim());
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <Field
        label="Referencia"
        value={reference}
        onChangeText={setReference}
        autoCapitalize="characters"
        maxLength={24}
        placeholder="DEMO-1042"
      />
      <Field
        label="Clave privada"
        value={key}
        onChangeText={setKey}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={36}
        placeholder="Clave de consulta"
      />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button label="Buscar reporte" onPress={() => void lookup()} busy={busy} />
    </Panel>
  );
}

function PageTitle({ title, description }: { title: string; description: string }) {
  return (
    <View style={layout.pageHeading}>
      <Text style={layout.pageTitle} accessibilityRole="header">{title}</Text>
      <Text style={styles.body}>{description}</Text>
    </View>
  );
}

const layout = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerContent: {
    width: '100%', maxWidth: 570, alignSelf: 'center', flexDirection: 'row',
    alignItems: 'center', gap: 10, paddingHorizontal: 16, minHeight: 67,
  },
  brand: { fontSize: 16, fontWeight: '800', color: colors.deep, letterSpacing: -0.25 },
  brandIcon: {
    width: 38, height: 38, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.gold, borderRadius: 13,
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -9 },
  content: { width: '100%', maxWidth: 570, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 19, gap: 14 },
  hero: {
    borderRadius: 20, overflow: 'hidden', backgroundColor: colors.deep,
    minHeight: 270, justifyContent: 'flex-end',
  },
  heroImage: { borderRadius: 20 },
  heroOverlay: {
    padding: 19, gap: 9, backgroundColor: 'rgba(80,17,30,0.92)',
    borderBottomWidth: 5, borderBottomColor: colors.gold,
  },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroTag: { color: colors.gold, fontSize: 13, fontWeight: '700' },
  heroTitle: { fontSize: 31, fontWeight: '800', color: colors.white, letterSpacing: -0.9 },
  heroText: { color: '#fff5e5', fontSize: 14, lineHeight: 20 },
  credit: { fontSize: 10, color: colors.muted, marginTop: -7, paddingBottom: 4, textAlign: 'right' },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '800', marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  category: {
    flexGrow: 1, width: '47%', padding: 12, gap: 6, backgroundColor: colors.white,
    borderRadius: 13, borderWidth: 1, borderColor: colors.border,
  },
  pageHeading: { gap: 7, paddingBottom: 5 },
  pageTitle: { color: colors.deep, fontWeight: '800', fontSize: 29, letterSpacing: -0.8 },
  success: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center',
    justifyContent: 'center', backgroundColor: colors.greenTint,
  },
  reference: { fontSize: 28, fontWeight: '800', color: colors.deep },
  key: { color: colors.brand, fontSize: 14, backgroundColor: colors.mist, padding: 10, borderRadius: 8 },
  historyEvent: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 4 },
});