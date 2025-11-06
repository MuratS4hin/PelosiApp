import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/ApiService';

const HomeScreen = () => {
  const [groupedData, setGroupedData] = useState({});
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const navigation = useNavigation();
  const [isRefreshing, setIsRefreshing] = useState(false);

  function parseCongressDate(d) {
    // Example input: "Jul. 27, 2025"
    const [monthStr, day, year] = d.replace(',', '').split(' ');
    const monthMap = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
    };
    return new Date(year, monthMap[monthStr.replace('.', '')], day);
  }

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setLoading(true);

    try {
      const data = await ApiService.get('congresstrades/grouped');
      const dateKeys = Object.keys(data).sort((a, b) =>
        parseCongressDate(b) - parseCongressDate(a)
      );

      setGroupedData(data);
      setDates(dateKeys);
      setSelectedDate((prev) => prev || dateKeys[0]);
    } catch (error) {
      console.error('Error fetching congress trades:', error);
    } finally {
      if (isRefresh) setIsRefreshing(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const renderItem = ({ item }) => {
    const typeText = item[1].split('\n')[0].toLowerCase();
    const isSale = typeText.includes("sale");
    const isPurchase = typeText.includes("purchase");

    const cardBackground = isSale
      ? "#FFCCCC"
      : isPurchase
        ? "#CCFFCC"
        : "#FFFFFF";

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cardBackground }]}
        onPress={() => {
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(endDate.getDate() - 30);

          navigation.navigate('StockDetail', {
            ticker: item[0].split('\n')[0].trim(),
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
          });
        }}
      >
        <Text style={styles.ticker}>{item[0].split('\n')[1]}</Text>

        <View style={styles.detailsRow}>
          <Text style={styles.detailsLeft}>
            {item[1].split('\n')[0]} {item[1].split('\n')[1]}
          </Text>
          <Text style={styles.detailsRight}>{item[3]}</Text>
        </View>

        <Text style={styles.details}>{item[2].split('\n')[0]}</Text>
        <Text style={styles.note}>{item[5]}</Text>
        <Text style={styles.percent}>{item[6]}</Text>
      </TouchableOpacity>
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
      {/* Custom dropdown */}
      <TouchableOpacity
        style={styles.dropdownButton}
        onPress={() => setShowDropdown(true)}
      >
        <Text style={styles.dropdownButtonText}>
          {selectedDate || 'Select a date'}
        </Text>
      </TouchableOpacity>

      {/* Modal dropdown */}
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
              data={dates}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedDate(item);
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

      {/* FlatList of items */}
      <FlatList
        data={groupedData[selectedDate] || []}
        keyExtractor={(_, index) => index.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 50 }}
        onRefresh={() => fetchData(true)} // triggers refresh
        refreshing={isRefreshing}
      />
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    flex: 1,
  },
  dropdownButton: {
    marginVertical: 10,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  dropdownList: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    maxHeight: 300,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 0.5,
    borderColor: '#ccc',
  },
  card: {
    backgroundColor: '#fff',
    padding: 14,
    paddingRight: 50, // ✅ reserve space for percent badge
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  ticker: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  details: {
    color: '#333',
    marginTop: 2,
  },
  note: {
    fontStyle: 'italic',
    color: '#555',
    marginTop: 4,
  },
  percent: {
    position: 'absolute',
    top: 10,
    right: 10,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

});
