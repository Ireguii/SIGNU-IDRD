import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

export const colors = {
  ink: '#332521', muted: '#62534c', deep: '#711323', brand: '#a61d30',
  mist: '#fff3d0', paper: '#faf6ed', white: '#ffffff', border: '#e8dcd0', gold: '#ffd24a',
  green: '#126549', greenTint: '#e4f5ed', red: '#9c2136', redTint: '#fff0f2', yellow: '#fff4cc',
};

export function Button({ label, onPress, icon, variant = 'primary', busy = false, disabled = false }: {
  label: string; onPress: () => void; icon?: ReactNode; variant?: 'primary' | 'outline' | 'text';
  busy?: boolean; disabled?: boolean;
}) {
  const primary = variant === 'primary';
  const color = primary ? colors.white : colors.brand;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || disabled, busy }} onPress={onPress}
      disabled={busy || disabled} style={({ pressed }) => [
        styles.button, primary && styles.primary, variant === 'outline' && styles.outline,
        pressed && styles.pressed, (busy || disabled) && styles.disabled,
      ]}>
      {busy ? <ActivityIndicator color={color} /> : icon}
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
      {primary && !busy && <Ionicons name="arrow-forward" size={17} color={color} />}
    </Pressable>
  );
}

export function Panel({ title, subtitle, number, children }: {
  title?: string; subtitle?: string; number?: string; children: ReactNode;
}) {
  return (
    <View style={styles.panel}>
      {title && (
        <View style={styles.panelHeading}>
          {number && <Text style={styles.number}>{number}</Text>}
          <View style={styles.flex}>
            <Text style={styles.panelTitle} accessibilityRole="header">{title}</Text>
            {subtitle && <Text style={styles.body}>{subtitle}</Text>}
          </View>
        </View>
      )}
      {children}
    </View>
  );
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[styles.input, props.multiline && styles.multiline, props.style]}
      />
      {hint && <Text style={styles.small}>{hint}</Text>}
    </View>
  );
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'error' | 'warning' }) {
  return (
    <View accessibilityRole={tone === 'error' ? 'alert' : undefined} style={[
      styles.notice, tone === 'error' && styles.error, tone === 'warning' && styles.warning,
    ]}>
      <Text style={[styles.body, tone === 'error' && { color: colors.red }]}>{children}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  button: { minHeight: 49, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderRadius: 12 },
  primary: { backgroundColor: colors.brand },
  outline: { borderWidth: 1, borderColor: '#e4b6bc', backgroundColor: colors.white },
  pressed: { opacity: 0.74 },
  disabled: { opacity: 0.62 },
  buttonText: { fontSize: 15, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  panel: { borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, padding: 17, gap: 14 },
  panelHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  number: { color: colors.brand, backgroundColor: colors.mist, borderRadius: 13, overflow: 'hidden', width: 27, textAlign: 'center', lineHeight: 27, fontSize: 13, fontWeight: '800' },
  panelTitle: { color: colors.ink, fontSize: 20, fontWeight: '800', letterSpacing: -0.35 },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  small: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  label: { fontSize: 14, fontWeight: '700', color: colors.ink },
  field: { gap: 6 },
  input: { minHeight: 48, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#d9c8bc', color: colors.ink, fontSize: 15, backgroundColor: colors.white },
  multiline: { minHeight: 105, textAlignVertical: 'top' },
  notice: { backgroundColor: colors.mist, padding: 12, borderRadius: 11 },
  error: { backgroundColor: colors.redTint },
  warning: { backgroundColor: colors.yellow },
});
