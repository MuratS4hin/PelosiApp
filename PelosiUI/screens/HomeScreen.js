import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ApiService from '../services/ApiService';

const HomeScreen = ({ navigation }) => {
  const [rawData, setRawData] = useState([]); 
  const [congressmenList, setCongressmenList] = useState([]);
  const [selectedCongressman, setSelectedCongressman] = useState('All');
  const [expandedTicker, setExpandedTicker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setLoading(true);

    try {
      const data = await ApiService.get('congresstrades/load_existing_data');
      const congressmen = await ApiService.get('congresstrades/congresspeople');
      
      // Extract names from [[id, name], ...] format
      const names = congressmen.map(item => item[1]);
      const sortedNames = ['All', ...names.sort((a, b) => a.localeCompare(b))];
      
      setRawData(data);
      setCongressmenList(sortedNames);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helpers to parse/format transaction dates
  const parseTxDate = (rawField) => {
    const raw = (rawField || '').toString().split('\n')[0].trim();
    if (!raw) return null;
    // Try native Date parsing first
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
      // mm/dd/yyyy
      let d2 = new Date(y, g1 - 1, g2);
      if (!isNaN(d2.getTime())) return d2;
      // dd/mm/yyyy
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

  // Grouped Stocks (Sorted by Ticker A-Z)
  const groupedStocks = useMemo(() => {
    const filtered = selectedCongressman === 'All' 
      ? rawData 
      : rawData.filter(item => item[1] === selectedCongressman);

    const groups = filtered.reduce((acc, item) => {
      const ticker = item[0];
      if (!acc[ticker]) {
        acc[ticker] = { 
          ticker, 
          companyName: item[4] || '', // Company name from data
          transactions: [] 
        };
      }
      const parsedDate = parseTxDate(item[2]);
      acc[ticker].transactions.push({
        name: item[1],
        dateRaw: item[2],
        date: parsedDate,
        type: item[3],
      });
      return acc;
    }, {});

    // --- SORTING LOGIC ---
    // Convert to array and sort by Ticker (A-Z)
    const sortedArray = Object.values(groups).sort((a, b) => 
      a.ticker.localeCompare(b.ticker)
    );

    // Sort transactions inside each ticker by date (Descending / Newest First)
    sortedArray.forEach(stock => {
      stock.transactions.sort((a, b) => {
        const ta = a.date ? a.date.getTime() : 0;
        const tb = b.date ? b.date.getTime() : 0;
        return tb - ta;
      });
    });

    return sortedArray;
  }, [rawData, selectedCongressman]);

  const renderItem = ({ item }) => {
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
                {item.companyName && <Text style={styles.companyName} numberOfLines={1}>({item.companyName})</Text>}
              </View>
              <Text style={styles.tradeCount}>
                {item.transactions.length} trade{item.transactions.length > 1 ? 's' : ''}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.arrowButton}
            onPress={() => setExpandedTicker(isExpanded ? null : item.ticker)}
            activeOpacity={0.6}
          >
            <Icon 
              name={isExpanded ? "chevron-up" : "chevron-down"} 
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
                  <Text style={styles.txDate}>{tx.date ? formatDateDDMMYYYY(tx.date) : (tx.dateRaw || '')}</Text>
                </View>
                <Text style={[
                  styles.txBadge, 
                  tx.type.toLowerCase().includes('purchase') ? styles.buyBadge : styles.sellBadge
                ]}>
                  {tx.type.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowFilterModal(true)}
        >
          <Text style={styles.filterButtonText}>
            <Icon name="filter" size={16} color="#007AFF" /> {selectedCongressman}
          </Text>
          <Icon name="chevron-down" size={20} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* FILTER MODAL */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Congressman</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
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
                  onPress={() => {
                    setSelectedCongressman(item);
                    setExpandedTicker(null);
                    setShowFilterModal(false);
                  }}
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
        onRefresh={() => fetchData(true)}
        refreshing={isRefreshing}
        contentContainerStyle={{ paddingVertical: 10, paddingBottom: 40 }}
        ListEmptyComponent={<Text style={styles.emptyText}>No trades found for {selectedCongressman}.</Text>}
      />
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
  emptyText: { textAlign: 'center', marginTop: 30, color: '#8E8E93' }
});