import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal
} from 'react-native';
import UseAppStore from '../store/UseAppStore';
import ApiService from '../services/ApiService';

const isValidIsoDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
};

const formatIsoDate = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getPreviousDay = (value) => {
  if (!isValidIsoDate(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return parsed.toISOString().slice(0, 10);
};

const parseNumeric = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/,/g, '').replace('%', '').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractPriceAtDate = (response) => {
  const payload = response?.data && typeof response.data === 'object' ? response.data : response;
  const chart = Array.isArray(payload?.chart)
    ? payload.chart
    : Array.isArray(payload?.prices)
      ? payload.prices
      : [];

  const closes = chart
    .map((point) => parseNumeric(point?.close ?? point?.c ?? point?.price ?? point?.value))
    .filter((value) => value !== null);

  if (closes.length) return closes[closes.length - 1];

  const fallback = parseNumeric(
    payload?.current_price
    ?? payload?.last_price
    ?? payload?.close
    ?? payload?.c
    ?? payload?.first_price
  );

  return fallback;
};

const AddAssetScreen = ({ navigation, route }) => {
  const addAsset = UseAppStore((state) => state.addAsset);
  const user = UseAppStore((state) => state.user);
  const [tickerList, setTickerList] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [ticker, setTicker] = useState(route.params?.ticker || '');
  const [stockPrice, setStockPrice] = useState(route.params?.buyPrice ? String(route.params.buyPrice) : '');
  const [buyDate, setBuyDate] = useState(route.params?.endDate || '');
  const [buyQuantity, setBuyQuantity] = useState('1');
  const [buyAmount, setBuyAmount] = useState(route.params?.buyPrice ? String(route.params.buyPrice) : '');
  const [lastEdited, setLastEdited] = useState('quantity');
  const [priceLoading, setPriceLoading] = useState(false);

  const updateFromPriceAndQuantity = (priceValue, quantityValue) => {
    const price = parseFloat(priceValue);
    const quantity = parseFloat(quantityValue);

    if (!Number.isFinite(price) || !Number.isFinite(quantity)) {
      return '';
    }

    return String(price * quantity);
  };

  const updateFromPriceAndAmount = (priceValue, amountValue) => {
    const price = parseFloat(priceValue);
    const amount = parseFloat(amountValue);

    if (!Number.isFinite(price) || !Number.isFinite(amount) || price === 0) {
      return '';
    }

    return String(amount / price);
  };

  const handleAmountChange = (value) => {
    setLastEdited('amount');
    setBuyAmount(value);
    setBuyQuantity(updateFromPriceAndAmount(stockPrice, value));
  };

  const handleQuantityChange = (value) => {
    setLastEdited('quantity');
    setBuyQuantity(value);
    setBuyAmount(updateFromPriceAndQuantity(stockPrice, value));
  };

  const fetchTickerList = async () => {
    try {
      const data = await ApiService.get(`congresstrades/tickers`);
      setTickerList(data);
    } catch (err) {
      console.error("Error fetching asset data:", err);
    }
  };

  useEffect(() => {
    fetchTickerList();
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchPriceByDate = async () => {
      if (!ticker || !isValidIsoDate(buyDate)) {
        if (mounted) setStockPrice('');
        return;
      }

      setPriceLoading(true);
      try {
        const normalizedTicker = ticker.toUpperCase();
        const startDate = getPreviousDay(buyDate);
        const endDate = buyDate;
        const res = await ApiService.get(`stocks/${encodeURIComponent(normalizedTicker)}?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`);
        const price = extractPriceAtDate(res);
        if (mounted) setStockPrice(price === null ? '' : String(price));
      } catch (err) {
        console.warn('Could not fetch stock price:', err?.message || err);
        if (mounted) setStockPrice('');
      } finally {
        if (mounted) setPriceLoading(false);
      }
    };

    fetchPriceByDate();

    return () => {
      mounted = false;
    };
  }, [ticker, buyDate]);

  useEffect(() => {
    if (!stockPrice) return;
    if (lastEdited === 'amount') {
      setBuyQuantity(updateFromPriceAndAmount(stockPrice, buyAmount));
      return;
    }
    setBuyAmount(updateFromPriceAndQuantity(stockPrice, buyQuantity));
  }, [stockPrice]);

  const handleAdd = async () => {
    const parsedPrice = parseFloat(stockPrice);
    const parsedAmount = parseFloat(buyAmount);
    const parsedQuantity = parseFloat(buyQuantity);
    const parsedBuyDate = new Date(buyDate);

    if (
      !ticker ||
      !Number.isFinite(parsedPrice) ||
      !Number.isFinite(parsedAmount) ||
      !Number.isFinite(parsedQuantity) ||
      parsedQuantity <= 0 ||
      Number.isNaN(parsedBuyDate.getTime())
    ) {
      return;
    }

    if (!user) {
      navigation.navigate('ProfileScreen', {
        redirectTo: 'AddAssetScreen',
        redirectParams: { ticker },
      });
      return;
    }

    try {
      const normalizedTicker = ticker.toUpperCase();
      const nowIso = new Date().toISOString();
      const clientId = `${normalizedTicker}-${Date.now()}`;

      const apiBody = {
        ticker: normalizedTicker,
        buyPrice: parsedPrice,
        buyDate,
        buyAmount: parsedAmount,
        buyQuantity: parsedQuantity,
        addedDate: nowIso,
        id: clientId,
      };

      const localAsset = {
        ticker: normalizedTicker,
        buyPrice: parsedPrice,
        buyDate,
        buyAmount: parsedAmount,
        buyQuantity: parsedQuantity,
        addedDate: nowIso,
        id: clientId,
      };

      await ApiService.addFavorite(apiBody);
      addAsset(localAsset);
    
    } catch (e) {
      console.warn('Could not save favorite:', e.message || e);
    }

    navigation.goBack();
  };

  const isSaveDisabled = !ticker || !stockPrice || !buyAmount || !buyQuantity || !buyDate || priceLoading;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add To Favourite</Text>

      {/* ✅ Ticker Input with Modal Dropdown */}
      <TouchableOpacity style={styles.input} onPress={() => setShowDropdown(true)} activeOpacity={0.7}>
        <Text style={ticker ? styles.inputValueText : styles.inputPlaceholderText}>
          {ticker || 'Select Ticker'}
        </Text>
      </TouchableOpacity>

      <Modal
        transparent
        visible={showDropdown}
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPressOut={() => setShowDropdown(false)}
        >
          <View style={styles.dropdownList}>
            <FlatList
              data={tickerList}
              keyExtractor={(item, idx) => idx.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setTicker(item);
                    setShowDropdown(false);
                  }}
                >
                  <Text>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>


      <TextInput
        style={styles.input}
        placeholder="Stock Price"
        keyboardType="numeric"
        value={stockPrice}
        editable={false}
      />

      <TextInput
        style={styles.input}
        placeholder="Buy Amount"
        keyboardType="numeric"
        value={buyAmount}
        onChangeText={handleAmountChange}
      />

      <TextInput
        style={styles.input}
        placeholder="Buy Quantity"
        keyboardType="numeric"
        value={buyQuantity}
        onChangeText={handleQuantityChange}
      />

      <TextInput
        style={styles.input}
        placeholder="Buy Date (YYYY-MM-DD)"
        value={buyDate}
        onChangeText={setBuyDate}
      />

      <TouchableOpacity style={[styles.button, isSaveDisabled && styles.buttonDisabled]} onPress={handleAdd} disabled={isSaveDisabled}>
        <Text style={[styles.buttonText, isSaveDisabled && styles.buttonTextDisabled]}>Save Asset</Text>
      </TouchableOpacity>
    </View>
  );
};

export default AddAssetScreen;

const styles = StyleSheet.create({
  container: { padding: 20, flex: 1, backgroundColor: '#F9FAFB' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    marginVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
  },
  inputValueText: {
    color: '#111827',
    fontSize: 14,
  },
  inputPlaceholderText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#007AFF',
    marginTop: 20,
    padding: 14,
    borderRadius: 8,
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.8,
  },
  buttonText: { textAlign: 'center', color: '#fff', fontSize: 16 },
  buttonTextDisabled: {
    color: '#E5E7EB',
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    marginBottom: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 60,
  },

  dropdownList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    paddingVertical: 6,
    maxHeight: '80%'
  },

  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.6,
    borderColor: '#ddd',
  },
});
