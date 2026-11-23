import { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  createReportsApi,
  demoPoints,
  readableError,
  type Category,
  type CategoryId,
  type ParkMatch,
  type Photo,
  type Point,
  type Report,
  type ReportInput,
  type Risk,
} from './api';
import { locateDevice } from './location';
import { ParkMap } from './ParkMap';
import { Button, colors, Field, Notice, Panel, styles } from './ui';

type Api = ReturnType<typeof createReportsApi>;
type SelectedPoint = { point: Point; method: 'gps' | 'manual'; accuracyM?: number };

function createReportKey(): string {
  const bytes = Crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

const riskOptions = [
  { id: 'yes', label: 'Sí' },
  { id: 'no', label: 'No' },
  { id: 'unsure', label: 'No sé' },
] as const;

export function ReportForm({
  api,
  categories,
  initialCategory = null,
  onCreated,
  onBusyChange,
}: {
  api: Api;
  categories: Category[];
  initialCategory?: CategoryId | null;
  onCreated: (report: Report, key: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const quickReport = initialCategory !== null;
  const [location, setLocation] = useState<SelectedPoint | null>(null);
  const [match, setMatch] = useState<ParkMatch | null>(null);
  const [checkingPark, setCheckingPark] = useState(false);
  const [parkError, setParkError] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [detail, setDetail] = useState('');
  const [category, setCategory] = useState<CategoryId | null>(initialCategory);
  const [description, setDescription] = useState('');
  const [risk, setRisk] = useState<Risk | null>(null);
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [photoMessage, setPhotoMessage] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const lastAttempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const locationRequest = useRef(0);

  useEffect(() => () => { locationRequest.current += 1; }, []);

  useEffect(() => {
    if (!location) return;

    const controller = new AbortController();
    setCheckingPark(true);
    setMatch(null);
    setParkError(false);

    const timer = setTimeout(() => {
      void api.identify(location.point, controller.signal).then((result) => {
        if (!controller.signal.aborted) setMatch(result);
      }).catch(() => {
        if (!controller.signal.aborted) setParkError(true);
      }).finally(() => {
        if (!controller.signal.aborted) setCheckingPark(false);
      });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [api, location]);

  function select(point: Point) {
    locationRequest.current += 1;
    setLocating(false);
    setLocation({ point, method: 'manual' });
    setLocationMessage('');
  }

  async function useGps() {
    const request = ++locationRequest.current;
    setLocating(true);
    setLocationMessage('');

    try {
      const position = await locateDevice();
      if (request === locationRequest.current) setLocation(position);
    } catch (error) {
      if (request === locationRequest.current) {
        setLocationMessage(
          error instanceof Error ? error.message : 'No pudimos obtener tu ubicación. Puedes tocar el mapa.'
        );
      }
    } finally {
      if (request === locationRequest.current) setLocating(false);
    }
  }

  async function choosePhoto(camera: boolean) {
    if (photoBusy) return;

    setPhotoBusy(true);
    setPhotoMessage('');

    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.75,
        exif: false,
      };

      if (camera && Platform.OS !== 'web') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setPhotoMessage('Permiso de cámara denegado. También puedes elegir una foto de la galería.');
          return;
        }
      }

      const result = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled) return;

      const asset = result.assets[0];
      const size = asset.fileSize ?? asset.file?.size;

      if (size && size > 8 * 1024 * 1024) {
        setPhotoMessage('Elige una fotografía de máximo 8 MB.');
        return;
      }

      if (asset.mimeType && !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType)) {
        setPhotoMessage('Elige una fotografía JPG, PNG o WebP.');
        return;
      }

      setPhoto({
        uri: asset.uri,
        name: asset.fileName ?? undefined,
        size,
        mimeType: asset.mimeType,
        file: asset.file,
      });
    } catch {
      setPhotoMessage('No se pudo abrir la cámara o galería. Inténtalo de nuevo.');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function submit() {
    if (submitting.current) return;

    setError('');
    const cleanDescription = description.trim();
    const cleanDetail = detail.trim();
    const cleanEmail = email.trim();

    if (!location || !category || cleanDescription.length < 10) {
      setError(quickReport
        ? 'Marca la ubicación y describe el problema en al menos 10 caracteres.'
        : 'Marca la ubicación, selecciona una categoría y describe el problema en al menos 10 caracteres.');
      return;
    }

    if (!quickReport && (cleanDetail.length < 3 || !risk)) {
      setError('Indica una referencia del lugar y selecciona si hay riesgo.');
      return;
    }

    if (!quickReport && cleanEmail && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || !consent)) {
      setError('Si deseas compartir tu correo, verifica su formato y autoriza su uso para este reporte.');
      return;
    }

    const input: ReportInput = {
      ...location,
      category,
      description: cleanDescription,
      detail: quickReport
        ? (location.method === 'gps' ? 'Ubicación del dispositivo' : 'Punto señalado en el mapa')
        : cleanDetail,
      risk: quickReport ? 'unsure' : (risk ?? 'unsure'),
      ...(!quickReport && cleanEmail ? { email: cleanEmail, consent: 'demo-1' } : {}),
    };

    const fingerprint = JSON.stringify([input, photo?.uri]);
    submitting.current = true;
    setBusy(true);
    onBusyChange(true);

    try {
      if (lastAttempt.current?.fingerprint !== fingerprint) {
        lastAttempt.current = { fingerprint, key: createReportKey() };
      }

      const key = lastAttempt.current.key;
      const report = await api.create(input, photo, key);
      onCreated(report, key);
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      submitting.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <View style={formStyles.layout}>
      <Panel
        number="1"
        title="Ubicación"
        subtitle={quickReport
          ? 'Toca el lugar del daño o usa tu ubicación como punto de partida.'
          : 'Señala el punto y dinos cómo encontrarlo.'}
      >
        <ParkMap point={location?.point ?? null} onPick={select} />
        <Text style={styles.small}>
          Toca el mapa para elegir el punto. En la demo, consultamos ese punto en la capa pública de Catastro Bogotá.
        </Text>
        <Button
          label="Usar mi ubicación"
          icon={<Ionicons name="locate-outline" size={17} color={colors.brand} />}
          variant="outline"
          busy={locating}
          onPress={() => void useGps()}
        />
        <View style={formStyles.row}>
          {demoPoints.map(({ label, point }) => (
            <Chip
              key={label}
              label={label}
              active={location?.point.latitude === point.latitude && location.point.longitude === point.longitude}
              onPress={() => select(point)}
            />
          ))}
        </View>

        {locationMessage ? <Notice tone="warning">{locationMessage}</Notice> : null}

        {location && (
          <View style={formStyles.selected}>
            <Ionicons name="location-outline" size={18} color={colors.brand} />
            <View style={styles.flex}>
              <Text accessibilityLiveRegion="polite" style={styles.label}>
                {checkingPark
                  ? 'Buscando parque…'
                  : match?.park?.name ?? (parkError ? 'Consulta geográfica no disponible' : 'Parque sin identificar')}
              </Text>
              <Text style={styles.small}>
                {location.method === 'gps'
                  ? 'Ubicación del dispositivo. Puedes ajustar el punto en el mapa.'
                  : 'Punto seleccionado en el mapa.'}
              </Text>
              {match && (
                <Text style={styles.small}>
                  {match.park?.locality ? `${match.park.locality} · ` : ''}
                  {match.source === 'public' ? 'Capa pública de Catastro Bogotá' : 'Muestra local de parques'}
                </Text>
              )}
            </View>
          </View>
        )}

        {!quickReport && (
          <Field
            label="¿En qué parte ocurre? *"
            value={detail}
            onChangeText={setDetail}
            placeholder="Ej. Sendero norte, junto al poste L-07"
            maxLength={120}
          />
        )}
      </Panel>

      <Panel number="2" title="Problema" subtitle="Describe el daño y agrega una foto si la tienes.">
        {quickReport ? (
          <Text style={styles.label}>
            Categoría: {categories.find((item) => item.id === initialCategory)?.label}
          </Text>
        ) : (
          <>
            <Text style={styles.label}>Tipo de problema *</Text>
            <View style={formStyles.row}>
              {categories.map((item) => (
                <Chip
                  key={item.id}
                  label={item.label}
                  active={item.id === category}
                  onPress={() => setCategory(item.id)}
                />
              ))}
            </View>
          </>
        )}

        <Field
          label="¿Qué sucedió? *"
          multiline
          maxLength={500}
          value={description}
          onChangeText={setDescription}
          hint={`${description.length} / 500 caracteres`}
          placeholder="Ej. El vidrio de la luminaria está quebrado y la luz no enciende."
        />
        <Text style={styles.label}>Foto del problema · Opcional</Text>

        {photo && (
          <View style={formStyles.photo}>
            <Image
              source={{ uri: photo.uri }}
              style={formStyles.thumbnail}
              accessibilityLabel="Vista previa de la evidencia"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quitar foto"
              onPress={() => setPhoto(null)}
              style={formStyles.remove}
            >
              <Ionicons name="close" size={20} color={colors.ink} />
            </Pressable>
          </View>
        )}

        <View style={formStyles.row}>
          <View style={styles.flex}>
            <Button
              label="Tomar foto"
              variant="outline"
              disabled={photoBusy || locating}
              onPress={() => void choosePhoto(true)}
              icon={<Ionicons name="camera-outline" size={17} color={colors.brand} />}
            />
          </View>
          <View style={styles.flex}>
            <Button
              label="Galería"
              variant="outline"
              disabled={photoBusy}
              onPress={() => void choosePhoto(false)}
              icon={<Ionicons name="image-outline" size={17} color={colors.brand} />}
            />
          </View>
        </View>

        {photoMessage
          ? <Notice tone="warning">{photoMessage}</Notice>
          : <Text style={styles.small}>JPG, PNG o WebP, máximo 8 MB. Evita rostros y datos personales.</Text>}

        {!quickReport && (
          <>
            <Text style={styles.label}>¿Hay riesgo para las personas? *</Text>
            <View style={formStyles.row}>
              {riskOptions.map((item) => (
                <Chip
                  key={item.id}
                  label={item.label}
                  active={item.id === risk}
                  onPress={() => setRisk(item.id)}
                />
              ))}
            </View>
            <Text style={styles.small}>Tu respuesta orienta la revisión. El equipo técnico asignaría la prioridad.</Text>
          </>
        )}
      </Panel>

      {!quickReport && (
        <Panel number="3" title="Revisión y contacto" subtitle="Verifica los datos antes de enviar.">
          <View style={formStyles.summary}>
            <Text style={styles.label}>
              {categories.find((item) => item.id === category)?.label ?? 'Selecciona un tipo de problema'}
            </Text>
            <Text style={styles.body}>
              {match?.park?.name ?? 'Ubicación seleccionada en el mapa'}
              {detail.trim() ? ` · ${detail.trim()}` : ''}
            </Text>
          </View>
          <Field
            label="Correo electrónico · Opcional"
            value={email}
            maxLength={254}
            onChangeText={(text) => {
              setEmail(text);
              if (!text.trim()) setConsent(false);
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="tu.correo@ejemplo.com"
            hint="Para la demo, usa una dirección de ejemplo. El sistema guarda el correo y no envía mensajes."
          />
          {email.trim() ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consent }}
              onPress={() => setConsent(!consent)}
              style={formStyles.consent}
            >
              <Text style={[formStyles.checkbox, consent && formStyles.checked]}>{consent ? '✓' : ''}</Text>
              <Text style={[styles.body, styles.flex]}>Autorizo guardar mi correo de ejemplo para este reporte.</Text>
            </Pressable>
          ) : null}
        </Panel>
      )}

      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button
        label={busy ? 'Guardando reporte…' : 'Enviar reporte de demostración'}
        busy={busy}
        disabled={photoBusy}
        onPress={() => void submit()}
      />
      <Text style={styles.small}>Recibirás una referencia de demostración y una clave privada de consulta.</Text>
    </View>
  );
}

function Chip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[formStyles.chip, active && formStyles.active]}
    >
      <Text style={[styles.label, active && { color: colors.brand }]}>{label}</Text>
    </Pressable>
  );
}

const formStyles = StyleSheet.create({
  layout: { gap: 15 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 42, paddingHorizontal: 11, paddingVertical: 9, justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: 9,
  },
  active: { backgroundColor: colors.mist, borderColor: colors.brand },
  selected: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12,
    borderRadius: 10, backgroundColor: colors.mist,
  },
  summary: { gap: 4, padding: 12, borderRadius: 10, backgroundColor: colors.paper },
  photo: { position: 'relative' },
  thumbnail: { height: 145, width: '100%', borderRadius: 12 },
  remove: {
    position: 'absolute', right: 8, top: 8, height: 44, width: 44, alignItems: 'center',
    justifyContent: 'center', backgroundColor: colors.white, borderRadius: 22,
  },
  consent: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  checkbox: {
    width: 22, height: 22, borderWidth: 1, borderColor: colors.brand,
    borderRadius: 4, textAlign: 'center', color: colors.white,
  },
  checked: { backgroundColor: colors.brand },
});