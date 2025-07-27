import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/ApiService';

const HomeScreen = () => {
  const [groupedData, setGroupedData] = useState({});
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();

  const fetchData = async () => {
    try {
      const data = await ApiService.get('congresstrades/grouped');
      const dateKeys = Object.keys(data).sort(
        (a, b) => new Date(b) - new Date(a)
      );

      setGroupedData(data);
      setDates(dateKeys);
      setSelectedDate(dateKeys[0]); // Latest date
    } catch (error) {
      console.error('Error fetching congress trades:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('StockDetail', { ticker: item[0].split('\n')[0].trim() })}
    >
      <Text style={styles.ticker}>{item[0]}</Text>
      <Text style={styles.details}>{item[1]}</Text>
      <Text style={styles.details}>{item[2]}</Text>
      <Text style={styles.details}>Purchase: {item[3]} - {item[4]}</Text>
      <Text style={styles.note}>{item[5]}</Text>
      <Text style={styles.percent}>{item[6]}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Picker
        selectedValue={selectedDate}
        style={styles.picker}
        onValueChange={(itemValue) => setSelectedDate(itemValue)}
      >
        {dates.map((date) => (
          <Picker.Item key={date} label={date} value={date} />
        ))}
      </Picker>

      <FlatList
        data={groupedData[selectedDate] || []}
        keyExtractor={(_, index) => index.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 50 }}
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
  picker: {
    marginVertical: 10,
  },
  card: {
    backgroundColor: '#fff',
    padding: 14,
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
    marginTop: 4,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
