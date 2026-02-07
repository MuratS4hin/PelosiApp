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
import ModalSelector from 'react-native-modal-selector';
import UseAppStore from '../store/UseAppStore';
import ApiService from '../services/ApiService';

const AddAssetScreen = ({ navigation, route }) => {
  const addAsset = UseAppStore((state) => state.addAsset);
  const [tickerList, setTickerList] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [ticker, setTicker] = useState(route.params?.ticker || '');
  const [buyPrice, setBuyPrice] = useState('');
  const [buyDate, setBuyDate] = useState('');

  const fetchTickerList = async () => {
    try {
      const data = await ApiService.get(`congresstrades/tickers`);
      setTickerList(data);
    } catch (err) {
      console.error("Error fetching asset data:", err);
    }
  };

  const fetchTickerData = async (ticker) => {
    try {
      const now = new Date();
      const oneYearAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate()-1);
      const defaultStartDate = oneYearAgo.toISOString().split('T')[0];
      const defaultEndDate = now.toISOString().split('T')[0];
      const res = await ApiService.get(`stocks/${ticker}?start=${defaultStartDate}&end=${defaultEndDate}`);
      setBuyPrice(res.last_price.toString());
      setBuyDate(defaultEndDate);
    } catch (err) {
      console.error("Error fetching asset data:", err);
      return null;
    }
  }

  useEffect(() => {
    fetchTickerList();
    if(ticker) {
      fetchTickerData(ticker);
    }
  }, []);

  const handleAdd = () => {
    if (!ticker || !buyPrice || !buyDate) return;

    addAsset({
      ticker,
      buyPrice: parseFloat(buyPrice),
      buyDate,
      id: `${ticker}-${Date.now()}`,
    });

    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Asset</Text>

      {/* ✅ Ticker Input with Modal Dropdown */}
      <TextInput
        style={styles.input}
        placeholder="Select Ticker"
        value={ticker}
        editable={false}
        onPress={() => setShowDropdown(true)}
      />

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
        placeholder="Buy Price"
        keyboardType="numeric"
        value={buyPrice}
        onChangeText={setBuyPrice}
      />

      <TextInput
        style={styles.input}
        placeholder="Buy Date (YYYY-MM-DD)"
        value={buyDate}
        onChangeText={setBuyDate}
      />

      <TouchableOpacity style={styles.button} onPress={handleAdd}>
        <Text style={styles.buttonText}>Save Asset</Text>
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
  },
  button: {
    backgroundColor: '#007AFF',
    marginTop: 20,
    padding: 14,
    borderRadius: 8,
  },
  buttonText: { textAlign: 'center', color: '#fff', fontSize: 16 },
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
    maxHeight: '%80'
  },

  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.6,
    borderColor: '#ddd',
  },
});
