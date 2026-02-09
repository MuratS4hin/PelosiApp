import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Dimensions, TouchableOpacity, FlatList, ScrollView, Linking, Modal, Pressable, Alert } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import UseAppStore from '../store/UseAppStore';
import ApiService from '../services/ApiService';

const StockDetailScreen = ({ route, navigation }) => {
  // Set default dates (last 1 year) if not provided
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  
  const defaultStartDate = oneYearAgo.toISOString().split('T')[0];
  const defaultEndDate = now.toISOString().split('T')[0];
  
  const { ticker, startDate = defaultStartDate, endDate = defaultEndDate } = route.params || {};
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(true);
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [showTxModal, setShowTxModal] = useState(false);
  const myAssets = UseAppStore((state) => state.myAssets);
  const removeAsset = UseAppStore((state) => state.removeAsset);
  const isAssetAdded = myAssets.some(asset => asset.ticker === ticker);

  const handleStarPress = () => {
    if (isAssetAdded) {
      // Ask for confirmation to remove
      Alert.alert(
        'Remove from List',
        `Do you want to remove ${ticker} from your list?`,
        [
          { text: 'No', onPress: () => {}, style: 'cancel' },
          { text: 'Yes', onPress: () => removeAsset(ticker), style: 'destructive' }
        ]
      );
    } else {
      // Add to list
      navigation.navigate('AddAssetScreen', { ticker: ticker });
    }
  };

  useEffect(() => {
    const fetchStockInfo = async () => {
      try {
        const res = await ApiService.get(`stocks/${ticker}?start=${startDate}&end=${endDate}`);
        setStockData(res);
      } catch (error) {
        console.error('Error loading stock info', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStockInfo();
    // fetch company news (finnhub)
    const fetchNews = async () => {
      setNewsLoading(true);
      try {
        const n = await ApiService.getFinnhubCompanyNews(ticker, startDate, endDate);
        setNews(Array.isArray(n) ? n : []);
      } catch (e) {
        console.warn('Could not load news:', e.message || e);
        setNews([]);
      } finally {
        setNewsLoading(false);
      }
    };
    fetchNews();
    // fetch recommendation trends (finnhub)
    const fetchRecommendations = async () => {
      setRecLoading(true);
      try {
        const rec = await ApiService.getFinnhubRecommendationTrends(ticker);
        setRecommendations(Array.isArray(rec) ? rec : []);
      } catch (e) {
        console.warn('Could not load recommendations:', e.message || e);
        setRecommendations([]);
      } finally {
        setRecLoading(false);
      }
    };
    fetchRecommendations();
  }, [ticker, startDate, endDate]);

  // Fetch transactions (raw rows) and filter by ticker
  useEffect(() => {
    let mounted = true;
    const fetchTransactions = async () => {
      setTxLoading(true);
      try {
        const all = await ApiService.get('congresstrades/load_existing_data');
        // filter rows where the first column contains the ticker (robust to formats)
        const filtered = (all || []).filter(row => {
          try {
            const stockField = (row[0] || '').toString();
            const rowTicker = stockField.split('\n')[0].trim().toUpperCase();
            return rowTicker === (ticker || '').toUpperCase();
          } catch (e) {
            return false;
          }
        });
        if (mounted) setTransactions(filtered);
      } catch (e) {
        console.error('Error fetching transactions for ticker', e);
      } finally {
        if (mounted) setTxLoading(false);
      }
    };
    fetchTransactions();
    return () => { mounted = false; };
  }, [ticker]);

  // Update header options when isAssetAdded changes
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={{ marginRight: 10 }}
          onPress={handleStarPress}
        >
          <Icon 
            name={isAssetAdded ? "star" : "star-outline"} 
            size={28} 
            color="#FFD700" 
          />
        </TouchableOpacity>
      ),
    });
  }, [isAssetAdded, ticker, navigation]);

  if (loading) {
    return <ActivityIndicator size="large" style={{ marginTop: 50 }} />;
  }

  if (!stockData) {
    return <Text style={styles.errorText}>No data available for {ticker}</Text>;
  }

  // Compute simple analytics from chart
  const chartCloses = (stockData.chart || []).map(p => Number(p.close)).filter(v => !isNaN(v));
  const high = chartCloses.length ? Math.max(...chartCloses) : null;
  const low = chartCloses.length ? Math.min(...chartCloses) : null;
  const avg = chartCloses.length ? (chartCloses.reduce((a,b) => a+b,0) / chartCloses.length) : null;
  const pctChange = chartCloses.length > 1 ? (((chartCloses[chartCloses.length-1] - chartCloses[0]) / chartCloses[0]) * 100) : null;
  const latestRec = Array.isArray(recommendations) && recommendations.length > 0 ? recommendations[0] : null;

  // Helpers to parse and format transaction/report dates
  const parseTxDate = (rawField) => {
    const raw = (rawField || '').toString().split('\n')[0].trim();
    if (!raw) return null;
    // Try native Date parsing first (handles ISO and common formats)
    let d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
    // Try replacing dots with slashes
    d = new Date(raw.replace(/\./g, '/'));
    if (!isNaN(d.getTime())) return d;
    // Try explicit dd/mm/yyyy or mm/dd/yyyy patterns
    const m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) {
      const g1 = parseInt(m[1], 10);
      const g2 = parseInt(m[2], 10);
      const y = parseInt(m[3], 10);
      // Try mm/dd/yyyy
      let d2 = new Date(y, g1 - 1, g2);
      if (!isNaN(d2.getTime())) return d2;
      // Try dd/mm/yyyy
      d2 = new Date(y, g2 - 1, g1);
      if (!isNaN(d2.getTime())) return d2;
    }
    return null;
  };

  const formatDateDDMMYYYY = (d) => {
    if (!d) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // Sort transactions by reported date (newest first)
  const sortedTransactions = (transactions || []).slice().sort((a, b) => {
    // 1. Extract the date string exactly how renderItem does (from index 2)
    const rawDateA = (a[2] || '').toString().split('\n')[0];
    const rawDateB = (b[2] || '').toString().split('\n')[0];

    // 2. Parse them
    const da = parseTxDate(rawDateA);
    const db = parseTxDate(rawDateB);

    // 3. Sort Newest -> Oldest (b - a)
    if (da && db) return db - da;

    // Handle invalid dates (keep valid dates at the top)
    if (da) return -1;
    if (db) return 1;
    return 0;
  });

  return (
    <>
      <FlatList
      data={sortedTransactions}
      keyExtractor={(item, idx) => `${ticker}-tx-${idx}`}
      contentContainerStyle={{ padding: 0 }}
      ListHeaderComponent={(
        <View style={{ paddingTop: 20, paddingHorizontal: 20 }}>
          {/* Price header: large price + percent badge */}
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.title}>{ticker}</Text>
              <Text style={styles.companyText}>{stockData.company_name}</Text>
            </View>
            <View style={styles.priceBox}>
              {/* prefer chart last close if available */}
              {chartCloses.length > 0 ? (
                <Text style={styles.priceText}>${chartCloses[chartCloses.length - 1].toFixed(2)}</Text>
              ) : (
                <Text style={styles.priceText}>${Number(stockData.last_price).toFixed(2)}</Text>
              )}
              <View style={[styles.percentBadge, (pctChange >= 0) ? styles.percentUp : styles.percentDown]}>
                <Text style={styles.percentText}>{pctChange !== null ? `${pctChange.toFixed(2)}%` : (stockData.percent_change || '-')}</Text>
              </View>
            </View>
          </View>

          {/* Interactive Chart */}
          {stockData.chart && stockData.chart.length > 0 && (() => {
            const isPositive = pctChange >= 0;
            const lineColor = isPositive ? '#10B981' : '#EF4444';
            const gradientColor = isPositive ? '#10B98140' : '#EF444440';
            
            // Create data points with labels
            const chartData = stockData.chart.map((point, index) => {
              const date = new Date(point.date);
              const day = String(date.getDate()).padStart(2, '0');
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const year = date.getFullYear();
              
              return {
                value: Number(point.close),
                date: `${day}.${month}.${year}`,
                label: index % Math.floor(stockData.chart.length / 6) === 0 ? `${day}.${month}` : '',
                labelTextStyle: { color: '#6B7280', fontSize: 10 }
              };
            });

            const screenWidth = Dimensions.get('window').width;
            const parentPadding = 40; // 20 on each side
            const containerPadding = 3; // 10 on each side
            const yAxisWidth = 45;
            const availableWidth = screenWidth - parentPadding - containerPadding;
            const plotWidth = availableWidth - yAxisWidth - 10; // extra margin for safety
            
            const spacing = chartData.length > 1 ? Math.min(plotWidth / (chartData.length - 1), 40) : 20;
            const maxVal = high ? high * 1.05 : 100;

            return (
              <View style={styles.chartContainer}>
                <LineChart
                  data={chartData}
                  width={availableWidth}
                  height={220}
                  spacing={spacing}
                  initialSpacing={0}
                  endSpacing={0}
                  color={lineColor}
                  thickness={3}
                  startFillColor={gradientColor}
                  endFillColor={gradientColor}
                  startOpacity={0.9}
                  endOpacity={0.3}
                  curved
                  areaChart
                  hideDataPoints={false}
                  dataPointsHeight={1}
                  dataPointsWidth={1}
                  dataPointsColor={lineColor}
                  dataPointsRadius={0.5}
                  textColor1="#6B7280"
                  textShiftY={-8}
                  textShiftX={-10}
                  textFontSize={10}
                  yAxisColor="#E5E7EB"
                  xAxisColor="#E5E7EB"
                  yAxisThickness={1}
                  xAxisThickness={1}
                  yAxisTextStyle={{ color: '#6B7280', fontSize: 11 }}
                  rulesColor="#E5E7EB"
                  rulesType="solid"
                  yAxisLabelWidth={45}
                  noOfSections={5}
                  maxValue={maxVal}
                  pointerConfig={{
                    pointerStripHeight: 200,
                    pointerStripColor: lineColor,
                    pointerStripWidth: 2,
                    pointerColor: lineColor,
                    radius: 6,
                    pointerLabelWidth: 120,
                    pointerLabelHeight: 90,
                    activatePointersOnLongPress: false,
                    autoAdjustPointerLabelPosition: true,
                    pointerLabelComponent: items => {
                      return (
                        <View style={styles.tooltipContainer}>
                          <Text style={styles.tooltipDate}>{items[0].date}</Text>
                          <Text style={styles.tooltipPrice}>${items[0].value.toFixed(2)}</Text>
                        </View>
                      );
                    },
                  }}
                />
              </View>
            );
          })()}

          {/* Data & Analytics */}
          <Text style={styles.sectionTitle}>Data & Analytics</Text>
          <View style={styles.statsRowWrap}>
            <View style={styles.statBoxPrimary}>
              <Text style={styles.statLabel}>High</Text>
              <Text style={styles.statValue}>{high ? `$${high.toFixed(2)}` : '-'}</Text>
            </View>
            <View style={styles.statBoxPrimary}>
              <Text style={styles.statLabel}>Low</Text>
              <Text style={styles.statValue}>{low ? `$${low.toFixed(2)}` : '-'}</Text>
            </View>
            <View style={styles.statBoxPrimary}>
              <Text style={styles.statLabel}>Avg</Text>
              <Text style={styles.statValue}>{avg ? `$${avg.toFixed(2)}` : '-'}</Text>
            </View>
            <View style={styles.statBoxPrimary}>
              <Text style={styles.statLabel}>% Change</Text>
              <Text style={[styles.statValue, (pctChange >= 0) ? { color: '#2E7D32' } : { color: '#C62828' }]}>{pctChange !== null ? `${pctChange.toFixed(2)}%` : '-'}</Text>
            </View>
          </View>

          {/* Recommendation Trends */}
          {/* <Text style={styles.sectionTitle}>Recommendation Trends</Text> */}
          {recLoading ? (
            <ActivityIndicator style={{ marginTop: 8 }} />
          ) : latestRec ? (
            (() => {
              const strongBuy = Number(latestRec.strongBuy ?? 0);
              const buy = Number(latestRec.buy ?? 0);
              const hold = Number(latestRec.hold ?? 0);
              const sell = Number(latestRec.sell ?? 0);
              const strongSell = Number(latestRec.strongSell ?? 0);
              const total = strongBuy + buy + hold + sell + strongSell;

              if (!total) {
                return <Text style={styles.recEmpty}>No recommendation data available</Text>;
              }

              return (
                <View style={{ marginTop: 6 }}>
                  <View style={styles.recBar}>
                    {strongBuy > 0 && <View style={[styles.recSegment, styles.recStrongBuy, { flex: strongBuy }]} />}
                    {buy > 0 && <View style={[styles.recSegment, styles.recBuy, { flex: buy }]} />}
                    {hold > 0 && <View style={[styles.recSegment, styles.recHold, { flex: hold }]} />}
                    {sell > 0 && <View style={[styles.recSegment, styles.recSell, { flex: sell }]} />}
                    {strongSell > 0 && <View style={[styles.recSegment, styles.recStrongSell, { flex: strongSell }]} />}
                  </View>
                  <View style={styles.recLegend}>
                    <View style={styles.recLegendItem}>
                      <View style={[styles.recLegendDot, styles.recStrongBuy]} />
                      <Text style={styles.recLegendText}>Strong Buy</Text>
                    </View>
                    <View style={styles.recLegendItem}>
                      <View style={[styles.recLegendDot, styles.recBuy]} />
                      <Text style={styles.recLegendText}>Buy</Text>
                    </View>
                    <View style={styles.recLegendItem}>
                      <View style={[styles.recLegendDot, styles.recHold]} />
                      <Text style={styles.recLegendText}>Hold</Text>
                    </View>
                    <View style={styles.recLegendItem}>
                      <View style={[styles.recLegendDot, styles.recSell]} />
                      <Text style={styles.recLegendText}>Sell</Text>
                    </View>
                    <View style={styles.recLegendItem}>
                      <View style={[styles.recLegendDot, styles.recStrongSell]} />
                      <Text style={styles.recLegendText}>Strong Sell</Text>
                    </View>
                  </View>
                </View>
              );
            })()
          ) : (
            <Text style={styles.recEmpty}>No recommendation data available</Text>
          )}

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Transactions</Text>
          {txLoading && <ActivityIndicator style={{ marginTop: 0 }} />}
        </View>
      )}
      renderItem={({ item }) => {
        // item is a row array; try to extract fields robustly
        const typeField = (item[1] || '').toString();
        const politicianField = (item[2] || '').toString();
        const transaction = (item[3] || item[4] || '').toString();
        const politician = typeField.split('\n')[0];
        const rawDateField = politicianField.split('\n')[0];
        const chamberParty = (politicianField.split('\n')[1] || '').trim();
        const parsedDate = parseTxDate(rawDateField);
        const date = parsedDate ? formatDateDDMMYYYY(parsedDate) : rawDateField;

        return (
          <TouchableOpacity activeOpacity={0.85} onPress={() => { setSelectedTx(item); setShowTxModal(true); }}>
            <View style={styles.txCard}>
              <View style={styles.txRowInner}>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.txName}>{politician || 'Unknown'}</Text>
                  {chamberParty ? <Text style={styles.txSub}>{chamberParty}</Text> : <Text style={styles.txDate}>{date}</Text>}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <View style={[styles.badgeWrap, transaction.toLowerCase().includes('purchase') ? styles.badgeBuyWrap : styles.badgeSellWrap]}>
                    <Text style={[styles.badgeText, transaction.toLowerCase().includes('purchase') ? styles.badgeBuyText : styles.badgeSellText]}>{transaction.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 10 }}>No transactions found.</Text>}
      ListFooterComponent={(
        <View style={{ paddingTop: 10, paddingHorizontal: 20, paddingBottom: 20 }}>
          {/* News */}
          <Text style={styles.sectionTitle}>News</Text>
          {/* <Text style={{ marginBottom: 12, color: '#8E8E93' }}>Latest company news:</Text> */}
          {newsLoading ? (
            <ActivityIndicator style={{ marginTop: 8 }} />
          ) : (
            (news && news.length > 0) ? (
              news.slice(0, 6).map((n, i) => {
                const dt = n.datetime ? new Date(n.datetime * 1000) : null;
                return (
                  <TouchableOpacity key={`news-${i}`} onPress={() => n.url && Linking.openURL(n.url)} activeOpacity={0.8}>
                    <View style={styles.newsCard}>
                      <Text style={styles.newsHeadline} numberOfLines={2}>{n.headline}</Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        <Text style={styles.newsSource}>{n.source || 'News'}</Text>
                        <Text style={styles.newsDate}>{dt ? formatDateDDMMYYYY(dt) : ''}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <TouchableOpacity onPress={() => Linking.openURL(`https://www.google.com/search?q=${ticker}+stock+news`)} style={styles.newsLink}>
                <Text style={{ color: '#007AFF' }}>Search News for {ticker}</Text>
              </TouchableOpacity>
            )
          )}
        </View>
      )}
      />

      <Modal
        visible={showTxModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTxModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Transaction Details</Text>
            {selectedTx ? (
              <>
                <Text style={styles.modalRow}><Text style={{fontWeight:'700'}}>Stock:</Text> {(selectedTx[0] || '').toString()}</Text>
                <Text style={styles.modalRow}><Text style={{fontWeight:'700'}}>Type:</Text> {(selectedTx[1] || '').toString()}</Text>
                <Text style={styles.modalRow}><Text style={{fontWeight:'700'}}>Politician:</Text> {(selectedTx[2] || '').toString()}</Text>
                <Text style={styles.modalRow}><Text style={{fontWeight:'700'}}>Reported Date:</Text> {(selectedTx[3] || selectedTx[4] || '').toString()}</Text>
                <Text style={styles.modalRow}><Text style={{fontWeight:'700'}}>Notes:</Text> {(selectedTx[5] || selectedTx[6] || '').toString()}</Text>
              </>
            ) : null}

            <Pressable onPress={() => setShowTxModal(false)} style={{ marginTop: 12, alignSelf: 'flex-end' }}>
              <Text style={{ color: '#007AFF', fontWeight: '700' }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  errorText: { marginTop: 20, textAlign: 'center', color: 'red' },
  sectionTitle: { marginTop: 24, marginBottom: 12, fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  statsRowWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 10 },
  statBoxPrimary: { width: '48%', padding: 12, backgroundColor: '#FAFBFF', marginBottom: 8, borderRadius: 10, alignItems: 'center', elevation: 1 },
  statLabel: { fontSize: 12, color: '#8E8E93' },
  statValue: { fontSize: 14, fontWeight: '700', marginTop: 6 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#E5E5EA' },
  txName: { fontSize: 14, fontWeight: '700', color: '#3A3A3C' },
  txDate: { fontSize: 12, color: '#8E8E93', marginTop: 4 },
  txBadge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  buyBadge: { backgroundColor: '#E8F5E9', color: '#2E7D32' },
  sellBadge: { backgroundColor: '#FFEBEE', color: '#C62828' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F4FF', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontWeight: '700', color: '#007AFF' },
  txSub: { fontSize: 12, color: '#8E8E93', marginTop: 4 },
  badgeWrap: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeBuyWrap: { backgroundColor: '#E8F5E9' },
  badgeSellWrap: { backgroundColor: '#FFEBEE' },
  badgeBuyText: { color: '#2E7D32' },
  badgeSellText: { color: '#C62828' },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: { width: '90%', backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  modalRow: { marginBottom: 6 },
  newsLink: { paddingVertical: 10 },
  newsCard: { backgroundColor: '#fff', marginHorizontal: 0, borderRadius: 12, padding: 8, marginBottom: 10, elevation: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, borderLeftWidth: 4, borderLeftColor: '#007AFF' },
  newsHeadline: { fontSize: 13, fontWeight: '700', color: '#1C1C1E', lineHeight: 18 },
  newsSource: { fontSize: 11, fontWeight: '600', color: '#007AFF' },
  newsDate: { fontSize: 11, color: '#8E8E93' },
  recBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: '#E5E7EB' },
  recSegment: { height: '100%' },
  recStrongBuy: { backgroundColor: '#1B5E20' },
  recBuy: { backgroundColor: '#2E7D32' },
  recHold: { backgroundColor: '#FBC02D' },
  recSell: { backgroundColor: '#EF6C00' },
  recStrongSell: { backgroundColor: '#C62828' },
  recLegend: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 10 },
  recLegendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 6 },
  recLegendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  recLegendText: { fontSize: 11, color: '#6B7280' },
  recEmpty: { marginTop: 6, color: '#8E8E93' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceBox: { alignItems: 'flex-end' },
  priceText: { fontSize: 20, fontWeight: '800', color: '#1C1C1E' },
  percentBadge: { marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  percentText: { color: '#fff', fontWeight: '700' },
  percentUp: { backgroundColor: '#2E7D32' },
  percentDown: { backgroundColor: '#C62828' },
  companyText: { color: '#6B7280', marginTop: 2 },
  txCard: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 12, padding: 8, marginBottom: 8, elevation: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  txRowInner: { flexDirection: 'row', alignItems: 'center' },
  amountText: { fontSize: 12, color: '#111827', marginTop: 6, fontWeight: '700' },
  chartContainer: {
    marginTop: 20,
    marginHorizontal: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  tooltipContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  tooltipDate: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  tooltipPrice: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default StockDetailScreen;
