import React from 'react';
import { View, Text, StyleSheet, Switch, ScrollView } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import UseAppStore from '../store/UseAppStore';

const ALERT_TYPES = [
  { key: 'freshFilings',    icon: 'clock-fast',          color: '#007AFF', label: 'Fresh Filings',    sub: 'New trades filed within 7 days' },
  { key: 'unusualActivity', icon: 'alert-circle-outline', color: '#E65100', label: 'Unusual Activity', sub: '3+ same-direction trades detected' },
  { key: 'priceMoves',      icon: 'trending-up',          color: '#2E7D32', label: 'Price Moves',      sub: 'Watchlist stocks move ≥5%' },
  { key: 'weeklyDigest',    icon: 'calendar-week',        color: '#6A0DAD', label: 'Weekly Digest',    sub: 'Summary of the week\'s activity' },
];

export default function NotificationPrefsScreen() {
  const notifPrefs    = UseAppStore((s) => s.notifPrefs);
  const setNotifPref  = UseAppStore((s) => s.setNotifPref);
  const myAssets      = UseAppStore((s) => s.myAssets);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      {/* Global alert types */}
      <Text style={styles.sectionLabel}>Alert Types</Text>
      <View style={styles.card}>
        {ALERT_TYPES.map((item, idx) => (
          <View key={item.key} style={[styles.row, idx < ALERT_TYPES.length - 1 && styles.rowBorder]}>
            <View style={[styles.iconBox, { backgroundColor: item.color + '18' }]}>
              <Icon name={item.icon} size={20} color={item.color} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={styles.rowSub}>{item.sub}</Text>
            </View>
            <Switch
              value={notifPrefs?.[item.key] !== false}
              onValueChange={(val) => setNotifPref(item.key, val)}
              trackColor={{ false: '#E5E7EB', true: '#BBD8FF' }}
              thumbColor={notifPrefs?.[item.key] !== false ? '#007AFF' : '#9CA3AF'}
            />
          </View>
        ))}
      </View>

      {/* Per-ticker alerts */}
      {myAssets.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Per-Ticker Alerts</Text>
          <Text style={styles.sectionSub}>Receive alerts for tickers in your watchlist</Text>
          <View style={styles.card}>
            {myAssets.map((asset, idx) => (
              <View key={asset.ticker} style={[styles.row, idx < myAssets.length - 1 && styles.rowBorder]}>
                <View style={[styles.iconBox, { backgroundColor: '#F3F4F6' }]}>
                  <Text style={styles.tickerInitial}>{(asset.ticker || '?')[0]}</Text>
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{asset.ticker}</Text>
                  <Text style={styles.rowSub}>Any congressional activity</Text>
                </View>
                <Switch
                  value={notifPrefs?.[`ticker_${asset.ticker}`] !== false}
                  onValueChange={(val) => setNotifPref(`ticker_${asset.ticker}`, val)}
                  trackColor={{ false: '#E5E7EB', true: '#BBD8FF' }}
                  thumbColor={notifPrefs?.[`ticker_${asset.ticker}`] !== false ? '#007AFF' : '#9CA3AF'}
                />
              </View>
            ))}
          </View>
        </>
      )}

      <View style={styles.noteCard}>
        <Icon name="bell-outline" size={16} color="#6B7280" />
        <Text style={styles.noteText}>
          {' '}Push notifications will be enabled in an upcoming update. Your preferences are saved and ready.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#F0F2F5' },
  sectionLabel:   { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
  sectionSub:     { fontSize: 13, color: '#9CA3AF', marginBottom: 10, marginLeft: 4 },
  card:           { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  row:            { flexDirection: 'row', alignItems: 'center', padding: 14 },
  rowBorder:      { borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  iconBox:        { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  tickerInitial:  { fontSize: 16, fontWeight: '800', color: '#374151' },
  rowText:        { flex: 1 },
  rowLabel:       { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  rowSub:         { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  noteCard:       { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#F3F4F6', borderRadius: 10, padding: 12, marginTop: 24 },
  noteText:       { fontSize: 13, color: '#6B7280', flex: 1, lineHeight: 20 },
});
