import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ApiService from '../services/ApiService';

const ALL_CONGRESSMAN = 'All';
const DATE_FILTER_OPTIONS = [7, 30, 90];

const normalizeCongressmen = (congressmen) => {
  if (!Array.isArray(congressmen)) return [ALL_CONGRESSMAN];
  const names = congressmen
    .map((item) => (Array.isArray(item) ? item[1] : item))
    .filter(Boolean);
  return [ALL_CONGRESSMAN, ...names.sort((a, b) => a.localeCompare(b))];
};

const parseTxDate = (rawField) => {
  const raw = (rawField || '').toString().split('\n')[0].trim();
  if (!raw) return null;
  let d = new Date(raw);
  if (!isNaN(d.getTime())) return d;
  d = new Date(raw.replace(/\./g, '/'));
  if (!isNaN(d.getTime())) return d;
  const m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const g1 = parseInt(m[1], 10);
    const g2 = parseInt(m[2], 10);
    const y = parseInt(m[3], 10);
    let d2 = new Date(y, g1 - 1, g2);
    if (!isNaN(d2.getTime())) return d2;
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

const buildGroupedStocks = (rawData, selectedCongressman, dateFilterDays) => {
  const filtered = selectedCongressman === ALL_CONGRESSMAN
    ? rawData
    : rawData.filter((item) => item[1] === selectedCongressman);

  const cutoffDate = dateFilterDays ? (() => {
    const d = new Date();
    d.setDate(d.getDate() - dateFilterDays);
    d.setHours(0, 0, 0, 0);
    return d;
  })() : null;

  const groups = filtered.reduce((acc, item) => {
    const ticker = item[0];
    if (!ticker) return acc;
    if (!acc[ticker]) {
      acc[ticker] = {
        ticker,
        companyName: item[4] || '',
        transactions: [],
      };
    }
    const parsedDate = parseTxDate(item[2]);
    if (cutoffDate) {
      if (!parsedDate) return acc;
      if (parsedDate < cutoffDate) return acc;
    }
    acc[ticker].transactions.push({
      name: item[1],
      dateRaw: item[2],
      date: parsedDate,
      type: item[3] || '',
    });
    return acc;
  }, {});

  const values = Object.values(groups);
  const filteredValues = cutoffDate
    ? values.filter((group) => group.transactions.length > 0)
    : values;
  const sortedArray = filteredValues.sort((a, b) => a.ticker.localeCompare(b.ticker));

  sortedArray.forEach((stock) => {
    stock.transactions.sort((a, b) => {
      const ta = a.date ? a.date.getTime() : 0;
      const tb = b.date ? b.date.getTime() : 0;
      return tb - ta;
    });
  });

  return sortedArray;
};

const getUniqueTickers = (rawData, selectedCongressman) => {
  const filtered = selectedCongressman === ALL_CONGRESSMAN
    ? rawData
    : rawData.filter((item) => item[1] === selectedCongressman);
  const tickers = new Set(filtered.map((item) => item[0]).filter(Boolean));
  return Array.from(tickers).sort();
};

const HomeScreen = ({ navigation }) => {
  const [rawData, setRawData] = useState([]); 
  const [congressmenList, setCongressmenList] = useState([]);
  const [selectedCongressman, setSelectedCongressman] = useState(ALL_CONGRESSMAN);
  const [expandedTicker, setExpandedTicker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' or 'tickers'
  const [dateFilterDays, setDateFilterDays] = useState(null); // null = all dates, or number of days
  const [tickerSearch, setTickerSearch] = useState('');
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [data, congressmen] = await Promise.all([
        ApiService.get('congresstrades/load_existing_data'),
        ApiService.get('congresstrades/congresspeople'),
      ]);

      if (!isMountedRef.current) return;

      setRawData(Array.isArray(data) ? data : []);
      setCongressmenList(normalizeCongressmen(congressmen));
    } catch (err) {
      console.error('Fetch error:', err);
      if (isMountedRef.current) setError('Failed to load data. Please try again.');
    } finally {
      if (!isMountedRef.current) return;
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchData();
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchData]);

  // Grouped Stocks (Sorted by Ticker A-Z)
  const groupedStocks = useMemo(
    () => buildGroupedStocks(rawData, selectedCongressman, dateFilterDays),
    [rawData, selectedCongressman, dateFilterDays]
  );

  // Get unique tickers (for ticker list tab)
  const uniqueTickers = useMemo(
    () => getUniqueTickers(rawData, selectedCongressman),
    [rawData, selectedCongressman]
  );

  const filteredTickers = useMemo(() => {
    const query = tickerSearch.trim().toLowerCase();
    if (!query) return uniqueTickers;
    return uniqueTickers.filter((ticker) =>
      ticker.toLowerCase().includes(query)
    );
  }, [uniqueTickers, tickerSearch]);

  const handleSelectCongressman = useCallback((item) => {
    setSelectedCongressman(item);
    setExpandedTicker(null);
    setShowFilterModal(false);
  }, []);

  const handleToggleExpand = useCallback((ticker) => {
    setExpandedTicker((prev) => (prev === ticker ? null : ticker));
  }, []);

  const handleOpenFilter = useCallback(() => setShowFilterModal(true), []);
  const handleCloseFilter = useCallback(() => setShowFilterModal(false), []);
  const handleRefresh = useCallback(() => fetchData(true), [fetchData]);

  const renderItem = useCallback(({ item }) => {
    const isExpanded = expandedTicker === item.ticker;
    return (
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <TouchableOpacity
            style={styles.cardTouchable}
            onPress={() => navigation.navigate('StockDetail', { ticker: item.ticker })}
            activeOpacity={0.7}
          >
            <View style={styles.cardHeader}>
              <View style={styles.tickerContainer}>
                <Text style={styles.ticker}>{item.ticker}</Text>
                {item.companyName && (
                  <Text style={styles.companyName} numberOfLines={1}>
                    ({item.companyName})
                  </Text>
                )}
              </View>
              <Text style={styles.tradeCount}>
                {item.transactions.length} trade{item.transactions.length > 1 ? 's' : ''}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.arrowButton}
            onPress={() => handleToggleExpand(item.ticker)}
            activeOpacity={0.6}
          >
            <Icon
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#007AFF"
            />
          </TouchableOpacity>
        </View>

        {isExpanded && (
          <View style={styles.dropdownContent}>
            {item.transactions.map((tx, index) => (
              <View key={`${item.ticker}-${tx.name}-${index}`} style={styles.txRow}>
                <View style={styles.txInfo}>
                  <Text style={styles.txName}>{tx.name}</Text>
                  <Text style={styles.txDate}>
                    {tx.date ? formatDateDDMMYYYY(tx.date) : (tx.dateRaw || '')}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.txBadge,
                    tx.type.toLowerCase().includes('purchase')
                      ? styles.buyBadge
                      : styles.sellBadge,
                  ]}
                >
                  {tx.type.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }, [expandedTicker, handleToggleExpand, navigation]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* TRANSACTIONS TAB */}
      {activeTab === 'transactions' && (
        <>
          <View style={styles.filterBar}>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={handleOpenFilter}
            >
              <Text style={styles.filterButtonText}>
                <Icon name="filter" size={16} color="#007AFF" /> {selectedCongressman}
              </Text>
              <Icon name="chevron-down" size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.dateFilterBar}>
            <Text style={styles.dateFilterLabel}>Filter by Date:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateFilterScroll}>
              <TouchableOpacity 
                style={[styles.dateFilterButton, dateFilterDays === null && styles.dateFilterButtonActive]}
                onPress={() => setDateFilterDays(null)}
              >
                <Text style={[styles.dateFilterButtonText, dateFilterDays === null && styles.dateFilterButtonTextActive]}>All</Text>
              </TouchableOpacity>
              {/* Quick date filters */}
              {DATE_FILTER_OPTIONS.map((days) => {
                const isActive = dateFilterDays === days;
                return (
                  <TouchableOpacity 
                    key={days}
                    style={[styles.dateFilterButton, isActive && styles.dateFilterButtonActive]}
                    onPress={() => setDateFilterDays(isActive ? null : days)}
                  >
                    <Text style={[styles.dateFilterButtonText, isActive && styles.dateFilterButtonTextActive]}>Last {days}d</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* FILTER MODAL */}
          <Modal
            visible={showFilterModal}
            transparent
            animationType="fade"
            onRequestClose={handleCloseFilter}
          >
            <View style={styles.modalBackground}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Filter by Congressman</Text>
                  <TouchableOpacity onPress={handleCloseFilter}>
                    <Icon name="close" size={24} color="#000" />
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={congressmenList}
                  keyExtractor={(item, idx) => idx.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.filterOption,
                        selectedCongressman === item && styles.filterOptionSelected
                      ]}
                      onPress={() => handleSelectCongressman(item)}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        selectedCongressman === item && styles.filterOptionTextSelected
                      ]}>
                        {item}
                      </Text>
                      {selectedCongressman === item && (
                        <Icon name="check" size={20} color="#007AFF" />
                      )}
                    </TouchableOpacity>
                  )}
                  scrollEnabled
                  style={{ maxHeight: '80%' }}
                />
              </View>
            </View>
          </Modal>

          <FlatList
            data={groupedStocks}
            keyExtractor={(item) => item.ticker}
            renderItem={renderItem}
            onRefresh={handleRefresh}
            refreshing={isRefreshing}
            contentContainerStyle={{ paddingVertical: 10, paddingBottom: 80 }}
            ListEmptyComponent={
              error ? (
                <Text style={styles.emptyText}>{error}</Text>
              ) : (
                <Text style={styles.emptyText}>No trades found for {selectedCongressman}.</Text>
              )
            }
          />
        </>
      )}

      {/* TICKERS TAB */}
      {activeTab === 'tickers' && (
        <FlatList
          data={filteredTickers}
          keyExtractor={(item) => item}
          ListHeaderComponent={(
            <View style={styles.tickerSearchContainer}>
              <Icon name="magnify" size={18} color="#8E8E93" />
              <TextInput
                style={styles.tickerSearchInput}
                value={tickerSearch}
                onChangeText={setTickerSearch}
                placeholder="Search ticker"
                placeholderTextColor="#8E8E93"
                autoCapitalize="characters"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
            </View>
          )}
          stickyHeaderIndices={[0]}
          renderItem={({ item: ticker }) => (
            <TouchableOpacity
              style={styles.tickerCard}
              onPress={() => navigation.navigate('StockDetail', { ticker })}
              activeOpacity={0.7}
            >
              <View style={styles.tickerCardContent}>
                <Text style={styles.tickerCardText}>{ticker}</Text>
                <Icon name="chevron-right" size={20} color="#007AFF" />
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingVertical: 10, paddingBottom: 80 }}
          ListEmptyComponent={
            error ? (
              <Text style={styles.emptyText}>{error}</Text>
            ) : (
              <Text style={styles.emptyText}>No tickers found for {selectedCongressman}.</Text>
            )
          }
        />
      )}

      {/* BOTTOM NAVIGATION */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={[styles.navButton, activeTab === 'transactions' && styles.navButtonActive]}
          onPress={() => setActiveTab('transactions')}
        >
          <Icon 
            name="pen" 
            size={24} 
            color={activeTab === 'transactions' ? '#007AFF' : '#8E8E93'} 
          />
          <Text style={[styles.navButtonText, activeTab === 'transactions' && styles.navButtonTextActive]}>
            Transactions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.navButton, activeTab === 'tickers' && styles.navButtonActive]}
          onPress={() => setActiveTab('tickers')}
        >
          <Icon 
            name="format-list-bulleted" 
            size={24} 
            color={activeTab === 'tickers' ? '#007AFF' : '#8E8E93'} 
          />
          <Text style={[styles.navButtonText, activeTab === 'tickers' && styles.navButtonTextActive]}>
            Stock List
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2F5' },
  filterBar: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E4E8',
    elevation: 4,
  },
  filterButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D1D6',
  },
  filterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  dateFilterBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E4E8',
  },
  dateFilterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A3A3C',
    marginBottom: 8,
  },
  dateFilterScroll: {
    flexDirection: 'row',
  },
  dateFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#F0F2F5',
    borderWidth: 1,
    borderColor: '#D1D1D6',
  },
  dateFilterButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  dateFilterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3A3A3C',
  },
  dateFilterButtonTextActive: {
    color: '#FFF',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E4E8',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  filterOptionSelected: {
    backgroundColor: '#F0F7FF',
  },
  filterOptionText: {
    fontSize: 16,
    color: '#3A3A3C',
  },
  filterOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 14,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTouchable: {
    flex: 1,
  },
  cardHeader: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  tickerContainer: {
    flex: 1,
    height: 30
  },
  arrowButton: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ticker: { fontSize: 16, fontWeight: '900', color: '#1C1C1E' },
  companyName: { fontSize: 11, fontWeight: '500', color: '#8E8E93', marginTop: 2},
  tradeCount: { color: '#007AFF', fontWeight: '600', fontSize: 14 },
  dropdownContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  txRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingVertical: 10, 
    borderBottomWidth: 0.5, 
    borderBottomColor: '#E5E5EA' 
  },
  txInfo: { flex: 1 },
  txName: { fontSize: 15, fontWeight: '700', color: '#3A3A3C' },
  txDate: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  txBadge: { 
    fontSize: 10, 
    fontWeight: 'bold', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 6,
    overflow: 'hidden'
  },
  buyBadge: { backgroundColor: '#E8F5E9', color: '#2E7D32' },
  sellBadge: { backgroundColor: '#FFEBEE', color: '#C62828' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', marginTop: 30, color: '#8E8E93' },
  tickerSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E4E8',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  tickerSearchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#1C1C1E',
  },
  tickerCard: {
    backgroundColor: '#fff',
    marginHorizontal: 14,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  tickerCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tickerCardText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E1E4E8',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },
  navButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  navButtonActive: {
    borderTopWidth: 3,
    borderTopColor: '#007AFF',
  },
  navButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 4,
  },
  navButtonTextActive: {
    color: '#007AFF',
  },
});