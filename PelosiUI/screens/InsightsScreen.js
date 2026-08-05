import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, ActivityIndicator, StyleSheet,
  TouchableOpacity, ScrollView,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import ApiService from '../services/ApiService';

// ── date helpers ──────────────────────────────────────────────────────────────
const parseTxDate = (rawField) => {
  const raw = (rawField || '').toString().split('\n')[0].trim();
  if (!raw) return null;
  let d = new Date(raw);
  if (!isNaN(d.getTime())) return d;
  d = new Date(raw.replace(/\./g, '/'));
  if (!isNaN(d.getTime())) return d;
  const m = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) {
    const g1 = parseInt(m[1], 10), g2 = parseInt(m[2], 10), y = parseInt(m[3], 10);
    let d2 = new Date(y, g1 - 1, g2);
    if (!isNaN(d2.getTime())) return d2;
    d2 = new Date(y, g2 - 1, g1);
    if (!isNaN(d2.getTime())) return d2;
  }
  return null;
};
const fmtDate = (d) => {
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

// ── insight computation (runs off the raw trade array) ────────────────────────
const computeInsights = (rawData) => {
  const now = Date.now();
  const MS7  = 7  * 86_400_000;
  const MS30 = 30 * 86_400_000;

  const freshFilings = [];
  const tickerMap = {};

  rawData.forEach((row) => {
    const ticker     = (row[0] || '').toString().split('\n')[0].trim();
    const congressman = (row[1] || '').toString().split('\n')[0].trim();
    const date       = parseTxDate(row[2]);
    const type       = (row[3] || '').toString();
    if (!ticker || !date || isNaN(date.getTime())) return;

    const age = now - date.getTime();

    if (age <= MS7) {
      freshFilings.push({ ticker, congressman, date, type });
    }

    if (age <= MS30) {
      if (!tickerMap[ticker]) tickerMap[ticker] = { purchases: 0, sales: 0, members: new Set() };
      if (type.toLowerCase().includes('purchase')) tickerMap[ticker].purchases++;
      else tickerMap[ticker].sales++;
      tickerMap[ticker].members.add(congressman);
    }
  });

  // Sort fresh filings newest-first
  freshFilings.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Unusual activity: 3+ same-direction trades by 2+ members in 30 days
  const unusual = Object.entries(tickerMap)
    .filter(([, v]) => (v.purchases >= 3 || v.sales >= 3) && v.members.size >= 2)
    .map(([ticker, v]) => ({
      ticker,
      direction: v.purchases >= v.sales ? 'BUYING' : 'SELLING',
      count: Math.max(v.purchases, v.sales),
      members: v.members.size,
    }))
    .sort((a, b) => b.count - a.count);

  // 30-day digest
  const week30 = rawData.filter((row) => {
    const d = parseTxDate(row[2]);
    return d && (now - d.getTime()) <= MS30;
  });
  const memberSet  = new Set(week30.map((r) => (r[1] || '').toString().split('\n')[0].trim()));
  const tickerSet  = new Set(week30.map((r) => (r[0] || '').toString().split('\n')[0].trim()));
  const memberCount = {};
  week30.forEach((r) => {
    const m = (r[1] || '').toString().split('\n')[0].trim();
    memberCount[m] = (memberCount[m] || 0) + 1;
  });
  const topMember = Object.entries(memberCount).sort((a, b) => b[1] - a[1])[0] || null;
  const purchases30 = week30.filter((r) => (r[3] || '').toLowerCase().includes('purchase')).length;

  const digest = {
    totalTrades:   week30.length,
    uniqueStocks:  tickerSet.size,
    uniqueMembers: memberSet.size,
    topMember:     topMember ? { name: topMember[0], count: topMember[1] } : null,
    purchases:     purchases30,
    sales:         week30.length - purchases30,
  };

  return { freshFilings, unusual, digest };
};

// ─────────────────────────────────────────────────────────────────────────────
export default function InsightsScreen({ navigation }) {
  const [rawData, setRawData]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeSection, setSection] = useState('alerts');

  useEffect(() => {
    let mounted = true;
    ApiService.get('congresstrades/load_existing_data')
      .then((data) => { if (mounted) { setRawData(Array.isArray(data) ? data : []); setLoading(false); } })
      .catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const insights = useMemo(() => computeInsights(rawData), [rawData]);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#007AFF" /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Section toggle */}
      <View style={styles.segmentRow}>
        {['alerts', 'digest'].map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.segment, activeSection === s && styles.segmentActive]}
            onPress={() => setSection(s)}
          >
            <Text style={[styles.segmentText, activeSection === s && styles.segmentTextActive]}>
              {s === 'alerts' ? '🔔  Alerts' : '📋  30-Day Digest'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeSection === 'alerts' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* ── Fresh filings ─────────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="clock-fast" size={18} color="#007AFF" />
              <Text style={styles.sectionTitle}> Fresh Filings (Last 7 Days)</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{insights.freshFilings.length}</Text>
              </View>
            </View>
            {insights.freshFilings.length === 0
              ? <Text style={styles.emptyNote}>No filings in the last 7 days.</Text>
              : insights.freshFilings.slice(0, 25).map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.alertCard}
                  onPress={() => navigation.navigate('StockDetail', { ticker: item.ticker })}
                  activeOpacity={0.75}
                >
                  <View style={styles.alertLeft}>
                    <Text style={styles.alertTicker}>{item.ticker}</Text>
                    <Text style={styles.alertMember}>{item.congressman}</Text>
                    <Text style={styles.alertDate}>{fmtDate(item.date)}</Text>
                  </View>
                  <View style={[
                    styles.typeBadge,
                    item.type.toLowerCase().includes('purchase') ? styles.buyBadge : styles.sellBadge,
                  ]}>
                    <Text style={[
                      styles.typeBadgeText,
                      item.type.toLowerCase().includes('purchase') ? styles.buyText : styles.sellText,
                    ]}>
                      {item.type.toLowerCase().includes('purchase') ? 'BUY' : 'SELL'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            }
          </View>

          {/* ── Unusual Activity ──────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="alert-circle-outline" size={18} color="#E65100" />
              <Text style={styles.sectionTitle}> Unusual Activity (30 Days)</Text>
              <View style={[styles.countBadge, { backgroundColor: '#FFF3E0' }]}>
                <Text style={[styles.countBadgeText, { color: '#E65100' }]}>{insights.unusual.length}</Text>
              </View>
            </View>
            {insights.unusual.length === 0
              ? <Text style={styles.emptyNote}>No unusual cluster activity detected.</Text>
              : insights.unusual.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.unusualCard}
                  onPress={() => navigation.navigate('StockDetail', { ticker: item.ticker })}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertTicker}>{item.ticker}</Text>
                    <Text style={styles.unusualMeta}>
                      {item.count} {item.direction} trades · {item.members} members
                    </Text>
                  </View>
                  <View style={[styles.typeBadge, item.direction === 'BUYING' ? styles.buyBadge : styles.sellBadge]}>
                    <Text style={[styles.typeBadgeText, item.direction === 'BUYING' ? styles.buyText : styles.sellText]}>
                      {item.direction}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            }
          </View>
        </ScrollView>
      ) : (
        /* ── 30-Day Digest ─────────────────────────────────── */
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text style={styles.digestTitle}>Last 30 Days Summary</Text>
          {[
            { icon: 'swap-horizontal',   label: 'Total Filings',    value: insights.digest.totalTrades,   color: '#007AFF' },
            { icon: 'chart-line',        label: 'Unique Stocks',    value: insights.digest.uniqueStocks,  color: '#2E7D32' },
            { icon: 'account-group',     label: 'Active Members',   value: insights.digest.uniqueMembers, color: '#6A0DAD' },
            { icon: 'arrow-up-bold',     label: 'Purchases',        value: insights.digest.purchases,     color: '#2E7D32' },
            { icon: 'arrow-down-bold',   label: 'Sales',            value: insights.digest.sales,         color: '#C62828' },
          ].map((stat, idx) => (
            <View key={idx} style={styles.digestRow}>
              <View style={[styles.digestIcon, { backgroundColor: stat.color + '18' }]}>
                <Icon name={stat.icon} size={20} color={stat.color} />
              </View>
              <Text style={styles.digestLabel}>{stat.label}</Text>
              <Text style={[styles.digestValue, { color: stat.color }]}>{stat.value}</Text>
            </View>
          ))}

          {insights.digest.topMember && (
            <View style={styles.topMemberCard}>
              <Text style={styles.topMemberLabel}>Most Active Member</Text>
              <Text style={styles.topMemberName}>{insights.digest.topMember.name}</Text>
              <Text style={styles.topMemberCount}>{insights.digest.topMember.count} filings in 30 days</Text>
            </View>
          )}

          {insights.digest.totalTrades > 0 && (
            <View style={styles.buyVsSellCard}>
              <Text style={styles.buyVsSellTitle}>Buy vs Sell Ratio</Text>
              <View style={styles.ratioBar}>
                <View style={[styles.ratioFill, styles.buyFill, { flex: insights.digest.purchases || 1 }]} />
                <View style={[styles.ratioFill, styles.sellFill, { flex: insights.digest.sales || 1 }]} />
              </View>
              <View style={styles.ratioLegend}>
                <Text style={styles.ratioLegendBuy}>
                  ▲ Buy {Math.round((insights.digest.purchases / insights.digest.totalTrades) * 100)}%
                </Text>
                <Text style={styles.ratioLegendSell}>
                  ▼ Sell {Math.round((insights.digest.sales / insights.digest.totalTrades) * 100)}%
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#F0F2F5' },
  centered:           { flex: 1, justifyContent: 'center', alignItems: 'center' },
  segmentRow:         { flexDirection: 'row', margin: 16, backgroundColor: '#E5E7EB', borderRadius: 12, padding: 3 },
  segment:            { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10 },
  segmentActive:      { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  segmentText:        { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  segmentTextActive:  { color: '#1C1C1E' },
  section:            { marginHorizontal: 16, marginBottom: 24 },
  sectionHeader:      { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionTitle:       { fontSize: 15, fontWeight: '700', color: '#1C1C1E', flex: 1 },
  countBadge:         { backgroundColor: '#EFF6FF', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  countBadgeText:     { fontSize: 12, fontWeight: '700', color: '#007AFF' },
  emptyNote:          { color: '#9CA3AF', fontSize: 14, paddingVertical: 8 },
  alertCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  alertLeft:      { flex: 1 },
  alertTicker:    { fontSize: 16, fontWeight: '800', color: '#1C1C1E' },
  alertMember:    { fontSize: 13, color: '#6B7280', marginTop: 2 },
  alertDate:      { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  typeBadge:      { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  typeBadgeText:  { fontSize: 12, fontWeight: '700' },
  unusualCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center',
    borderLeftWidth: 4, borderLeftColor: '#E65100',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  unusualMeta:  { fontSize: 13, color: '#6B7280', marginTop: 3 },
  buyBadge:     { backgroundColor: '#E8F5E9' },
  sellBadge:    { backgroundColor: '#FFEBEE' },
  buyText:      { color: '#2E7D32' },
  sellText:     { color: '#C62828' },
  digestTitle:  { fontSize: 18, fontWeight: '800', color: '#1C1C1E', marginBottom: 16 },
  digestRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 14, marginBottom: 10,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  digestIcon:       { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  digestLabel:      { flex: 1, fontSize: 15, fontWeight: '600', color: '#374151' },
  digestValue:      { fontSize: 20, fontWeight: '800' },
  topMemberCard:    { backgroundColor: '#EFF6FF', borderRadius: 14, padding: 16, marginTop: 10, marginBottom: 10 },
  topMemberLabel:   { fontSize: 12, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  topMemberName:    { fontSize: 18, fontWeight: '800', color: '#1E40AF', marginTop: 4 },
  topMemberCount:   { fontSize: 13, color: '#6B7280', marginTop: 3 },
  buyVsSellCard:    { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 6 },
  buyVsSellTitle:   { fontSize: 15, fontWeight: '700', color: '#1C1C1E', marginBottom: 12 },
  ratioBar:         { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden' },
  ratioFill:        { height: '100%' },
  buyFill:          { backgroundColor: '#2E7D32' },
  sellFill:         { backgroundColor: '#C62828' },
  ratioLegend:      { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  ratioLegendBuy:   { fontSize: 13, fontWeight: '700', color: '#2E7D32' },
  ratioLegendSell:  { fontSize: 13, fontWeight: '700', color: '#C62828' },
});
