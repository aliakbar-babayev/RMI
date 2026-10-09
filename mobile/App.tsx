import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, useFonts,
} from '@expo-google-fonts/poppins';
import { RiskDetail } from './src/components/RiskDetail';
import { TabBar } from './src/components/TabBar';
import { ActionsScreen } from './src/screens/ActionsScreen';
import { AnalyzeScreen } from './src/screens/AnalyzeScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { OverviewScreen } from './src/screens/OverviewScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { IconButton } from './src/ui';
import { Nav, NavContext, TabKey } from './src/nav';
import { colors, font, space } from './src/theme';

function Shell() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabKey>('overview');
  const [openId, setOpenId] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  const nav = useMemo<Nav>(() => ({
    openRisk: setOpenId, openSettings: () => setSettings(true), goTab: setTab, refresh,
  }), []);

  return (
    <NavContext.Provider value={nav}>
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.content}>
          {tab === 'overview' && <OverviewScreen refreshKey={refreshKey} />}
          {tab === 'risks' && <DashboardScreen refreshKey={refreshKey} onOpen={setOpenId} onAdd={() => setTab('add')} />}
          {tab === 'register' && <RegisterScreen refreshKey={refreshKey} />}
          {tab === 'actions' && <ActionsScreen refreshKey={refreshKey} />}
          {tab === 'add' && <AnalyzeScreen onDone={refresh} onOpen={setOpenId} />}
        </View>
        <TabBar tab={tab} onChange={setTab} bottomInset={insets.bottom} />
      </View>

      <RiskDetail riskId={openId} onClose={() => setOpenId(null)} onChanged={refresh} />

      <Modal visible={settings} animationType="slide" onRequestClose={() => setSettings(false)}>
        <View style={[s.root, { paddingTop: insets.top + space.md }]}>
          <View style={s.modalHead}>
            <IconButton label="‹" onPress={() => setSettings(false)} />
            <Text style={s.modalTitle}>Settings</Text>
            <View style={{ width: 40 }} />
          </View>
          <SettingsScreen onChanged={refresh} />
        </View>
      </Modal>
    </NavContext.Provider>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold });
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {fontsLoaded ? <Shell /> : <View style={[s.root, s.center]}><ActivityIndicator color={colors.accent} /></View>}
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingBottom: space.lg },
  modalTitle: { fontFamily: font.semibold, color: colors.text, fontSize: 17 },
});
