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
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import ApiService from '../services/ApiService';
import UseAppStore from '../store/UseAppStore';
import { computeConfidenceScore, getScoreLabel } from '../utils/ConfidenceScore';

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

const buildGroupedByDate = (rawData, selectedCongressman, dateFilterDays) => {
  if (!dateFilterDays) return [];
  const filtered = selectedCongressman === ALL_CONGRESSMAN
    ? rawData
    : rawData.filter((item) => item[1] === selectedCongressman);

  const cutoffDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() - dateFilterDays);
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const groups = filtered.reduce((acc, item) => {
    const parsedDate = parseTxDate(item[2]);
    if (!parsedDate || parsedDate < cutoffDate) return acc;
    const dateKey = formatDateDDMMYYYY(parsedDate);
    if (!acc[dateKey]) {
      acc[dateKey] = {
        dateKey,
        date: parsedDate,
        transactions: [],
      };
    }
    acc[dateKey].transactions.push({
      name: item[1],
      ticker: item[0],
      companyName: item[4] || '',
      type: item[3] || '',
    });
    return acc;
  }, {});

  const values = Object.values(groups).sort((a, b) => b.date.getTime() - a.date.getTime());
  values.forEach((group) => {
    group.transactions.sort((a, b) => {
      const nameCompare = (a.name || '').localeCompare(b.name || '');
      if (nameCompare !== 0) return nameCompare;
      return (a.ticker || '').localeCompare(b.ticker || '');
    });
  });
  return values;
};

const buildGroupedStocks = (rawData, selectedCongressman, dateFilterDays, txTypeFilter = 'all', sortOrder = 'signal') => {
  let filtered = selectedCongressman === ALL_CONGRESSMAN
    ? rawData
    : rawData.filter((item) => item[1] === selectedCongressman);


  if (txTypeFilter !== 'all') {
    filtered = filtered.filter((item) => {
      const type = (item[3] || '').toString().toLowerCase();
      return txTypeFilter === 'purchase' ? type.includes('purchase') : !type.includes('purchase');
    });
  }

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

  // Compute Congress Signal Score for each stock
  filteredValues.forEach((stock) => {
    stock.confidence = computeConfidenceScore(stock.transactions);
    stock.scoreInfo = getScoreLabel(stock.confidence);
  });

  // Sort based on sortOrder param
  const sortedArray =
    sortOrder === 'trades'
      ? filteredValues.sort((a, b) => b.transactions.length - a.transactions.length)
      : sortOrder === 'recent'
        ? filteredValues.sort((a, b) => {
            const latestA = Math.max(...a.transactions.filter((t) => t.date).map((t) => t.date.getTime()), 0);
            const latestB = Math.max(...b.transactions.filter((t) => t.date).map((t) => t.date.getTime()), 0);
            return latestB - latestA;
          })
        : filteredValues.sort((a, b) => b.confidence - a.confidence);

  sortedArray.forEach((stock) => {
    stock.transactions.sort((a, b) => {
      const ta = a.date ? a.date.getTime() : 0;
      const tb = b.date ? b.date.getTime() : 0;
      return tb - ta;
    });
  });

  return sortedArray;
};

const getUniqueTickers = (rawData) => {
  const tickers = new Set((rawData || []).map((item) => item[0]).filter(Boolean));
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
  const [txTypeFilter, setTxTypeFilter]     = useState('all');
  const [sortOrder, setSortOrder]           = useState('signal');
  const [filterModalTab, setFilterModalTab] = useState('member');
  const filterPresets      = UseAppStore((s) => s.filterPresets);
  const saveFilterPreset   = UseAppStore((s) => s.saveFilterPreset);
  const removeFilterPreset = UseAppStore((s) => s.removeFilterPreset);
  const { width }  = useWindowDimensions();
  const isTablet   = width >= 768;
  const numColumns = isTablet ? 2 : 1;
  const isMountedRef = useRef(true);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setLoading(true);
    setError(null);

    const maxAttempts = 3; // initial try + 2 retries
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const [data, congressmen] = await Promise.all([
          ApiService.get('congresstrades/load_existing_data'),
          ApiService.get('congresstrades/congresspeople'),
        ]);

        if (!isMountedRef.current) return;

        setRawData(Array.isArray(data) ? data : []);
        setCongressmenList(normalizeCongressmen(congressmen));
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        console.error('Fetch error:', err);
        if (!isMountedRef.current) return;
      }
    }

    if (lastError && isMountedRef.current) {
      setError(ApiService.toUserMessage(lastError));
    }

    if (!isMountedRef.current) return;
    setLoading(false);
    setIsRefreshing(false);
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
    () => buildGroupedStocks(rawData, selectedCongressman, dateFilterDays, txTypeFilter, sortOrder),
    [rawData, selectedCongressman, dateFilterDays, txTypeFilter, sortOrder]
  );

  const groupedByDate = useMemo(
    () => buildGroupedByDate(rawData, selectedCongressman, dateFilterDays),
    [rawData, selectedCongressman, dateFilterDays]
  );

  // Get unique tickers (for ticker list tab)
  const uniqueTickers = useMemo(
    () => getUniqueTickers(rawData),
    [rawData]
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

  const handleOpenFilter = useCallback(() => {
    setFilterModalTab('member');
    setShowFilterModal(true);
  }, []);

  const handleApplyPreset = useCallback((preset) => {
    setSelectedCongressman(preset.congressman);
    setTxTypeFilter(preset.txTypeFilter);
    setSortOrder(preset.sortOrder);
    if (preset.dateFilterDays !== undefined) setDateFilterDays(preset.dateFilterDays);
    setShowFilterModal(false);
  }, []);

  const handleSavePreset = useCallback(() => {
    const name = selectedCongressman !== ALL_CONGRESSMAN
      ? selectedCongressman
      : (txTypeFilter !== 'all' ? `${txTypeFilter === 'purchase' ? 'Buys' : 'Sells'} only` : 'Current Filters');
    saveFilterPreset({ name, congressman: selectedCongressman, txTypeFilter, sortOrder, dateFilterDays });
  }, [selectedCongressman, txTypeFilter, sortOrder, dateFilterDays, saveFilterPreset]);
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
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.tradeCount}>
                  {item.transactions.length} trade{item.transactions.length > 1 ? 's' : ''}
                </Text>
                {item.scoreInfo && (
                  <View style={[styles.scoreBadge, { backgroundColor: item.scoreInfo.bg }]}>
                    <Text style={[styles.scoreBadgeText, { color: item.scoreInfo.color }]}>
                      ● {item.confidence} · {item.scoreInfo.label}
                    </Text>
                  </View>
                )}
              </View>
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

  const renderDateGroupItem = useCallback(({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.dateGroupTitle}>{item.dateKey}</Text>
        <Text style={styles.tradeCount}>{item.transactions.length} trade{item.transactions.length > 1 ? 's' : ''}</Text>
      </View>
      <View style={styles.dropdownContent}>
        {item.transactions.map((tx, index) => (
          <View key={`${item.dateKey}-${tx.ticker}-${index}`} style={styles.txRow}>
            <Text style={styles.txTicker}>{tx.ticker}</Text>
            <View style={styles.txInfo}>
              <Text style={styles.txName}>{tx.name}</Text>
              <Text style={styles.txDate}>{tx.ticker}{tx.companyName ? ` (${tx.companyName})` : ''}</Text>
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
    </View>
  ), []);

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

          <FlatList
            data={dateFilterDays ? groupedByDate : groupedStocks}
            keyExtractor={(item) => (dateFilterDays ? item.dateKey : item.ticker)}
            renderItem={dateFilterDays ? renderDateGroupItem : renderItem}
            onRefresh={handleRefresh}
            refreshing={isRefreshing}
            contentContainerStyle={{ paddingVertical: 10, paddingBottom: 80 }}
            ListHeaderComponent={
              !dateFilterDays ? (
                <View style={styles.signalBanner}>
                  <Icon name="fire" size={15} color="#E65100" />
                  <Text style={styles.signalBannerText}> Ranked by Congressional Signal</Text>
                </View>
              ) : null
            }
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
          key={numColumns}
          data={filteredTickers}
          keyExtractor={(item) => item}
          numColumns={numColumns}
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
              style={[styles.tickerCard, numColumns === 2 && styles.tickerCardTablet]}
              onPress={() => navigation.navigate('StockDetail', { ticker })}
              activeOpacity={0.7}
            >
              <View style={styles.tickerCardContent}>
                <Text style={styles.tickerCardText}>{ticker}</Text>
                <Icon name="chevron-right" size={20} color="#007AFF" />
              </View>
            </TouchableOpacity>
          )}
            contentContainerStyle={{ paddingVertical: 10, paddingBottom: 80, paddingHorizontal: isTablet ? 40 : 0 }}
          ListEmptyComponent={
            error ? (
              <Text style={styles.emptyText}>{error}</Text>
            ) : (
              <Text style={styles.emptyText}>No tickers found for {selectedCongressman}.</Text>
            )
          }
        />
      )}

          {/* ENHANCED FILTER MODAL */}
          <Modal
            visible={showFilterModal}
            transparent
            animationType="slide"
            onRequestClose={handleCloseFilter}
          >
            <View style={styles.modalBackground}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Filters</Text>
                  <TouchableOpacity onPress={handleCloseFilter}>
                    <Icon name="close" size={24} color="#000" />
                  </TouchableOpacity>
                </View>

                {/* Tab row */}
                <View style={styles.modalTabRow}>
                  {['member', 'options'].map((tab) => (
                    <TouchableOpacity
                      key={tab}
                      style={[styles.modalTab, filterModalTab === tab && styles.modalTabActive]}
                      onPress={() => setFilterModalTab(tab)}
                    >
                      <Text style={[styles.modalTabText, filterModalTab === tab && styles.modalTabTextActive]}>
                        {tab === 'member' ? 'Member' : 'Sort & Filter'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {filterModalTab === 'member' ? (
                  <FlatList
                    data={congressmenList}
                    keyExtractor={(item, idx) => idx.toString()}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[
                          styles.filterOption,
                          selectedCongressman === item && styles.filterOptionSelected,
                        ]}
                        onPress={() => handleSelectCongressman(item)}
                      >
                        <Text style={[
                          styles.filterOptionText,
                          selectedCongressman === item && styles.filterOptionTextSelected,
                        ]}>
                          {item}
                        </Text>
                        {selectedCongressman === item && <Icon name="check" size={20} color="#007AFF" />}
                      </TouchableOpacity>
                    )}
                    scrollEnabled
                    style={{ maxHeight: '70%' }}
                  />
                ) : (
                  <ScrollView style={{ maxHeight: '70%' }}>
                    <View style={styles.optSection}>
                      <Text style={styles.optSectionTitle}>Transaction Type</Text>
                      <View style={styles.optRow}>
                        {[
                          { key: 'all', label: 'All' },
                          { key: 'purchase', label: '▲ Purchases' },
                          { key: 'sale', label: '▼ Sales' },
                        ].map((opt) => (
                          <TouchableOpacity
                            key={opt.key}
                            style={[styles.optChip, txTypeFilter === opt.key && styles.optChipActive]}
                            onPress={() => setTxTypeFilter(opt.key)}
                          >
                            <Text style={[styles.optChipText, txTypeFilter === opt.key && styles.optChipTextActive]}>
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <View style={styles.optSection}>
                      <Text style={styles.optSectionTitle}>Sort By</Text>
                      <View style={styles.optRow}>
                        {[
                          { key: 'signal', label: '⚡ Signal Score' },
                          { key: 'trades', label: '📊 Most Trades' },
                          { key: 'recent', label: '🕐 Most Recent' },
                        ].map((opt) => (
                          <TouchableOpacity
                            key={opt.key}
                            style={[styles.optChip, sortOrder === opt.key && styles.optChipActive]}
                            onPress={() => setSortOrder(opt.key)}
                          >
                            <Text style={[styles.optChipText, sortOrder === opt.key && styles.optChipTextActive]}>
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {filterPresets && filterPresets.length > 0 && (
                      <View style={styles.optSection}>
                        <Text style={styles.optSectionTitle}>Saved Presets</Text>
                        {filterPresets.map((preset, idx) => (
                          <View key={idx} style={styles.presetRow}>
                            <TouchableOpacity style={styles.presetApplyBtn} onPress={() => handleApplyPreset(preset)}>
                              <Icon name="bookmark-outline" size={16} color="#007AFF" />
                              <Text style={styles.presetName}>{preset.name}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => removeFilterPreset(idx)}>
                              <Icon name="close-circle" size={20} color="#C62828" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}

                    <TouchableOpacity style={styles.savePresetBtn} onPress={handleSavePreset}>
                      <Icon name="content-save-outline" size={18} color="#007AFF" />
                      <Text style={styles.savePresetBtnText}> Save Current Filters as Preset</Text>
                    </TouchableOpacity>
                  </ScrollView>
                )}
              </View>
            </View>
          </Modal>

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
  dateGroupTitle: { fontSize: 16, fontWeight: '800', color: '#1C1C1E' },
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
  txTicker: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1C1C1E',
    marginRight: 10,
    minWidth: 48,
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
      tickerCardTablet: { flex: 1, marginHorizontal: 8 },
      modalTabRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#E1E4E8',
        gap: 8,
      },
      modalTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
      modalTabActive: { backgroundColor: '#EFF6FF' },
      modalTabText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
      modalTabTextActive: { color: '#007AFF' },
      optSection: { paddingHorizontal: 16, paddingTop: 16 },
      optSectionTitle: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
      optRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
      optChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
      optChipActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
      optChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
      optChipTextActive: { color: '#fff' },
      presetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
      presetApplyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center' },
      presetName: { fontSize: 14, fontWeight: '600', color: '#374151', marginLeft: 8 },
      savePresetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: 16, padding: 14, backgroundColor: '#EFF6FF', borderRadius: 12, borderWidth: 1, borderColor: '#BFDBFE' },
      savePresetBtnText: { fontSize: 14, fontWeight: '700', color: '#007AFF' },
    color: '#007AFF',
  },
  scoreBadge: {
    marginTop: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  scoreBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  signalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginTop: 6,
    marginBottom: 8,
  },
  signalBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E65100',
    marginLeft: 4,
  },
});