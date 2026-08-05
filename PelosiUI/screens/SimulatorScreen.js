import React, { useEffect, useState } from 'react';
import {
  View, Text, ActivityIndicator, StyleSheet,
  ScrollView, TouchableOpacity, Dimensions,
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import ApiService from '../services/ApiService';

export default function SimulatorScreen({ route }) {
  const { ticker, txDate, txType, member } = route.params || {};
  const now = new Date().toISOString().split('T')[0];

  const [stockData, setStockData] = useState(null);
  const [spyData,   setSpyData]   = useState(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchAll = async () => {
      try {
        const [stock, spy] = await Promise.all([
          ApiService.get(`stocks/${ticker}?start=${txDate}&end=${now}`),
          ApiService.get(`stocks/SPY?start=${txDate}&end=${now}`),
        ]);
        if (mounted) { setStockData(stock); setSpyData(spy); }
      } catch (e) {
        console.warn('Simulator fetch error:', e.message || e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchAll();
    return () => { mounted = false; };
  }, [ticker, txDate]);

  if (loading) return <ActivityIndicator size="large" style={{ marginTop: 80 }} />;

  const closes    = (stockData?.chart || []).map((p) => Number(p.close)).filter((v) => !isNaN(v));
  const spyCloses = (spyData?.chart   || []).map((p) => Number(p.close)).filter((v) => !isNaN(v));

  const buyPrice     = closes[0]    || 0;
  const currentPrice = closes[closes.length - 1] || 0;
  const pctChange    = buyPrice ? ((currentPrice - buyPrice) / buyPrice) * 100 : 0;
  const plValue      = buyPrice ? (1000 * pctChange) / 100 : 0;

  const spyBuy     = spyCloses[0] || 0;
  const spyCurrent = spyCloses[spyCloses.length - 1] || 0;
  const spyPct     = spyBuy ? ((spyCurrent - spyBuy) / spyBuy) * 100 : 0;
  const spyPL      = spyBuy ? (1000 * spyPct) / 100 : 0;

  const isPositive = pctChange >= 0;
  const lineColor  = isPositive ? '#10B981' : '#EF4444';
  const beats      = pctChange > spyPct;

  const chartData  = closes.map((v) => ({ value: v }));
  const { width }  = Dimensions.get('window');

  const isBuy = (txType || '').toLowerCase().includes('purchase');

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      {/* Header */}
      <View style={styles.headerCard}>
        <Text style={styles.headerTicker}>{ticker}</Text>
        {member  && <Text style={styles.headerMember}>Trade by {member}</Text>}
        {txDate  && <Text style={styles.headerDate}>Filing date: {txDate}</Text>}
        {txType  && (
          <View style={[styles.typePill, isBuy ? styles.buyPill : styles.sellPill]}>
            <Text style={[styles.typePillText, isBuy ? styles.buyText : styles.sellText]}>
              {isBuy ? 'PURCHASE' : 'SALE'}
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Hypothetical $1,000 Investment</Text>
      <Text style={styles.hint}>If you invested $1,000 when this trade was filed</Text>

      {/* P/L cards */}
      <View style={styles.plRow}>
        <View style={[styles.plCard, isPositive ? styles.plCardPositive : styles.plCardNegative]}>
          <Text style={styles.plCardLabel}>{ticker}</Text>
          <Text style={[styles.plCardPct, { color: isPositive ? '#2E7D32' : '#C62828' }]}>
            {isPositive ? '+' : ''}{pctChange.toFixed(2)}%
          </Text>
          <Text style={[styles.plCardPL, { color: isPositive ? '#2E7D32' : '#C62828' }]}>
            {plValue >= 0 ? '+' : ''}${plValue.toFixed(2)}
          </Text>
          <Text style={styles.plMeta}>Bought: ${buyPrice.toFixed(2)}</Text>
          <Text style={styles.plMeta}>Now:    ${currentPrice.toFixed(2)}</Text>
        </View>

        <View style={styles.plCard}>
          <Text style={styles.plCardLabel}>S&P 500 (SPY)</Text>
          <Text style={[styles.plCardPct, { color: spyPct >= 0 ? '#2E7D32' : '#C62828' }]}>
            {spyPct >= 0 ? '+' : ''}{spyPct.toFixed(2)}%
          </Text>
          <Text style={[styles.plCardPL, { color: spyPct >= 0 ? '#2E7D32' : '#C62828' }]}>
            {spyPL >= 0 ? '+' : ''}${spyPL.toFixed(2)}
          </Text>
          <Text style={styles.plMeta}>Benchmark</Text>
        </View>
      </View>

      {/* Verdict */}
      <View style={[styles.verdictCard, beats ? styles.verdictPos : styles.verdictNeg]}>
        <Icon name={beats ? 'trophy' : 'trending-down'} size={22} color={beats ? '#1B5E20' : '#B71C1C'} />
        <Text style={[styles.verdictText, { color: beats ? '#1B5E20' : '#B71C1C' }]}>
          {beats
            ? `+${(pctChange - spyPct).toFixed(2)}% vs S&P 500 — Beat the market!`
            : `${(pctChange - spyPct).toFixed(2)}% vs S&P 500 — Underperformed`}
        </Text>
      </View>

      {/* Chart */}
      {chartData.length > 1 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Price History Since Filing</Text>
          <View style={styles.chartBox}>
            <LineChart
              data={chartData}
              width={width - 60}
              height={180}
              color={lineColor}
              thickness={2}
              curved
              hideDataPoints
              areaChart
              startFillColor={lineColor + '40'}
              endFillColor={lineColor + '10'}
              yAxisColor="#E5E7EB"
              xAxisColor="#E5E7EB"
              yAxisTextStyle={{ color: '#9CA3AF', fontSize: 10 }}
              rulesColor="#F3F4F6"
              noOfSections={4}
              initialSpacing={0}
              endSpacing={0}
              spacing={Math.max(1, Math.min((width - 100) / Math.max(chartData.length - 1, 1), 40))}
            />
          </View>
        </>
      )}

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Icon name="information-outline" size={14} color="#9CA3AF" />
        <Text style={styles.disclaimerText}>
          {' '}For educational purposes only. Past performance does not guarantee future results.
          Always consult a licensed financial advisor before investing.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F0F2F5' },
  headerCard:      { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  headerTicker:    { fontSize: 28, fontWeight: '900', color: '#1C1C1E' },
  headerMember:    { fontSize: 14, color: '#6B7280', marginTop: 4 },
  headerDate:      { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  typePill:        { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 10 },
  buyPill:         { backgroundColor: '#E8F5E9' },
  sellPill:        { backgroundColor: '#FFEBEE' },
  typePillText:    { fontSize: 12, fontWeight: '700' },
  buyText:         { color: '#2E7D32' },
  sellText:        { color: '#C62828' },
  sectionTitle:    { fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginBottom: 4 },
  hint:            { fontSize: 13, color: '#9CA3AF', marginBottom: 14 },
  plRow:           { flexDirection: 'row', gap: 12, marginBottom: 16 },
  plCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 2, borderColor: '#E5E7EB',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  plCardPositive:  { borderColor: '#DCFCE7' },
  plCardNegative:  { borderColor: '#FEE2E2' },
  plCardLabel:     { fontSize: 11, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  plCardPct:       { fontSize: 22, fontWeight: '800', marginTop: 8 },
  plCardPL:        { fontSize: 16, fontWeight: '700', marginTop: 2 },
  plMeta:          { fontSize: 11, color: '#9CA3AF', marginTop: 6 },
  verdictCard:     { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, marginBottom: 20, gap: 10 },
  verdictPos:      { backgroundColor: '#DCFCE7' },
  verdictNeg:      { backgroundColor: '#FEE2E2' },
  verdictText:     { fontSize: 14, fontWeight: '700', flex: 1 },
  chartBox: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 16,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  disclaimer:      { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
  disclaimerText:  { fontSize: 12, color: '#9CA3AF', flex: 1, lineHeight: 18 },
});
