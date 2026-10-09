import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, ApiError, getBaseUrl, getRole, setBaseUrl, setRole } from '../api';
import { Button, Card, ErrorText, Pill, h } from '../ui';
import { colors, font, space } from '../theme';
import { Role } from '../types';

const ROLES: Role[] = ['executive', 'analyst', 'auditor'];

export function SettingsScreen({ onChanged }: { onChanged: () => void }) {
  const [url, setUrl] = useState(getBaseUrl());
  const [role, setRoleState] = useState<Role>(getRole());
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function check() {
    setError(''); setStatus('');
    setBaseUrl(url);
    try {
      const hl = await api.health();
      setStatus(`Connected · model: ${hl.model}`);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Connection failed.');
    }
  }

  async function verify() {
    setError(''); setStatus('');
    try {
      const v = await api.verify();
      if (v.ok) setStatus(`Audit chain intact · ${v.checked} entries checked`);
      else setError(`Audit chain BROKEN at entry ${v.broken_at}.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Verification failed.');
    }
  }

  useEffect(() => { check(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">

      {(!!status || !!error) && (
        <View style={[s.status, { backgroundColor: error ? colors.pink : '#1c2416' }]}>
          <Text style={[s.statusText, { color: error ? colors.danger : colors.ok }]}>{error || status}</Text>
        </View>
      )}

      <Text style={[h.section, s.gap]}>Server</Text>
      <Card style={{ gap: space.sm }}>
        <TextInput
          style={s.input}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="http://192.168.1.20:8000"
          placeholderTextColor={colors.muted}
        />
        <Text style={h.muted}>Use your computer's address on the same Wi-Fi, not "localhost".</Text>
        <Button label="Connect" onPress={check} />
      </Card>

      <Text style={[h.section, s.gap]}>Role</Text>
      <Card style={{ gap: space.md }}>
        <View style={s.pills}>
          {ROLES.map((r) => (
            <Pill key={r} label={r[0].toUpperCase() + r.slice(1)} active={role === r} onPress={() => { setRole(r); setRoleState(r); onChanged(); }} />
          ))}
        </View>
        <Text style={h.muted}>Demo only: Phase 1 has no real login, and the server trusts this role. It is not access control.</Text>
      </Card>

      <Text style={[h.section, s.gap]}>Audit trail</Text>
      <Button label="Verify audit log integrity" kind="dark" onPress={verify} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  pad: { padding: space.lg, paddingTop: 0, paddingBottom: 60 },
  gap: { marginTop: space.xl },
  pills: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  input: { fontFamily: font.regular, backgroundColor: colors.input, color: colors.text, borderRadius: 18, padding: space.md, fontSize: 14 },
  status: { marginTop: space.lg, borderRadius: 18, padding: space.md },
  statusText: { fontFamily: font.medium, fontSize: 13 },
});
