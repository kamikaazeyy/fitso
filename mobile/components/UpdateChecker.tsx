import React, { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Updates from 'expo-updates';
import { colors } from '@/constants/theme';

type Phase =
  | 'checking'
  | 'downloading'
  | 'ready'
  | 'uptodate'
  | 'error'
  | 'disabled';

interface Diag {
  label: string;
  value: string;
}

function safeDiag(): Diag[] {
  const get = (label: string, fn: () => string | null | undefined | Date): Diag => {
    try {
      const v = fn();
      return { label, value: v instanceof Date ? v.toLocaleString() : (v ?? '—') };
    } catch {
      return { label, value: 'unavailable' };
    }
  };
  return [
    get('Channel', () => Updates.channel),
    get('Runtime', () => Updates.runtimeVersion?.slice(0, 16)),
    get('Update ID', () => Updates.updateId?.slice(0, 13) ?? 'embedded'),
    get('Bundle from', () => Updates.createdAt),
    get('Embedded launch', () => String(Updates.isEmbeddedLaunch)),
  ];
}

/**
 * OTA update watcher, mounted once at the router root. On cold start it checks
 * EAS for a new bundle, downloads it, and shows a banner/modal with a
 * "restart to apply" action plus diagnostic logs — so update failures are
 * visible instead of silent. Renders nothing in dev builds.
 */
export function UpdateChecker() {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('checking');
  const [logs, setLogs] = useState<string[]>([]);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProgressLogged = useRef(-1);

  useEffect(() => {
    if (__DEV__) return;

    const log = (msg: string) =>
      setLogs((prev) => [...prev.slice(-40), `${new Date().toLocaleTimeString()}  ${msg}`]);

    const sub = Updates.addUpdatesStateChangeListener((event) => {
      const ctx = event.context;
      if (ctx.isDownloading) {
        const pct = Math.round(ctx.downloadProgress * 100);
        if (pct - lastProgressLogged.current >= 10 || pct === 100) {
          lastProgressLogged.current = pct;
          log(`Downloading… ${pct}%`);
        }
      }
      if (ctx.downloadError) log(`Download error: ${ctx.downloadError.message}`);
      if (ctx.checkError) log(`Check error: ${ctx.checkError.message}`);
    });

    const autoHide = (ms: number) => {
      hideTimer.current = setTimeout(() => setBannerVisible(false), ms);
    };

    (async () => {
      try {
        if (!Updates.isEnabled) {
          setPhase('disabled');
          log('Updates.isEnabled = false — this binary predates expo-updates');
          setBannerVisible(true);
          return;
        }

        setBannerVisible(true);
        setPhase('checking');
        log('Checking EAS for updates…');

        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable) {
          setPhase('uptodate');
          log('No update available — running latest bundle');
          autoHide(3500);
          return;
        }

        setPhase('downloading');
        log('Update available — downloading…');
        const fetched = await Updates.fetchUpdateAsync();
        log(fetched.isNew ? 'Downloaded new bundle' : 'Bundle already downloaded');

        setPhase('ready');
        setModalVisible(true);
      } catch (error) {
        setPhase('error');
        log(`Failed: ${error instanceof Error ? error.message : String(error)}`);
        setBannerVisible(true);
        return;
      }

      // Pull the native expo-updates log so the modal shows what the native
      // layer actually did (request URL, manifest decisions, errors).
      try {
        const entries = await Updates.readLogEntriesAsync(60 * 60 * 1000);
        for (const e of entries.slice(-12)) {
          log(`[native:${e.code}] ${e.message.split('\n')[0].slice(0, 120)}`);
        }
      } catch {
        log('Native log unavailable');
      }
    })();

    return () => {
      sub.remove();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (__DEV__ || !bannerVisible) return null;

  const banner = {
    checking: { icon: 'sync-outline' as const, color: colors.cyan, text: 'Checking for update…' },
    downloading: { icon: 'cloud-download-outline' as const, color: colors.cyan, text: 'Downloading update…' },
    ready: { icon: 'sparkles-outline' as const, color: colors.cyan, text: 'Update ready — tap to restart' },
    uptodate: { icon: 'checkmark-circle-outline' as const, color: colors.cyan, text: 'App is up to date' },
    error: { icon: 'warning-outline' as const, color: colors.cta, text: 'Update check failed — tap for logs' },
    disabled: { icon: 'alert-circle-outline' as const, color: colors.yellow, text: 'This build can\'t receive OTA updates — install a newer APK' },
  }[phase];

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setModalVisible(true)}
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: insets.bottom + 90,
          backgroundColor: colors.surface,
          borderColor: banner.color,
          borderWidth: 1,
          borderRadius: 14,
          paddingVertical: 10,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Ionicons name={banner.icon} size={18} color={banner.color} />
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', marginLeft: 8, flex: 1 }}>
          {banner.text}
        </Text>
        <Ionicons name="chevron-up" size={16} color="#8E8E93" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 20, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name={banner.icon} size={22} color={banner.color} />
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700', marginLeft: 8, flex: 1 }}>
                {phase === 'ready' ? 'Update ready' : 'Update status'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            {phase === 'ready' && (
              <Text style={{ color: '#A0A0A0', fontSize: 13, marginBottom: 12 }}>
                A new version was downloaded. Restart to apply it now, or it will apply on the next launch.
              </Text>
            )}

            <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 10, marginBottom: 12 }}>
              {safeDiag().map((d) => (
                <View key={d.label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                  <Text style={{ color: '#8E8E93', fontSize: 12 }}>{d.label}</Text>
                  <Text style={{ color: '#fff', fontSize: 12, fontFamily: 'monospace' }} numberOfLines={1}>
                    {d.value}
                  </Text>
                </View>
              ))}
            </View>

            <ScrollView style={{ maxHeight: 140, marginBottom: 14 }} nestedScrollEnabled>
              {logs.length === 0 ? (
                <Text style={{ color: '#555', fontSize: 11 }}>No log entries</Text>
              ) : (
                logs.map((l, i) => (
                  <Text key={i} style={{ color: '#A0A0A0', fontSize: 11, fontFamily: 'monospace', paddingVertical: 1 }}>
                    {l}
                  </Text>
                ))
              )}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              {phase === 'ready' && (
                <TouchableOpacity
                  onPress={() => Updates.reloadAsync()}
                  style={{ flex: 1, backgroundColor: colors.cta, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Restart now</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  if (phase === 'uptodate') setBannerVisible(false);
                }}
                style={{
                  flex: 1,
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>{phase === 'ready' ? 'Later' : 'Close'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
