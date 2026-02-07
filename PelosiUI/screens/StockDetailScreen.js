import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
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
  const myAssets = UseAppStore((state) => state.myAssets);
  const isAssetAdded = myAssets.some(asset => asset.ticker === ticker);

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
  }, [ticker, startDate, endDate]);

  // Update header options when isAssetAdded changes
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={{ marginRight: 10 }}
          onPress={() => navigation.navigate('AddAssetScreen', { ticker: ticker })}
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{ticker} Stock Details</Text>
      <Text>Company: {stockData.company_name}</Text>
      <Text>Latest Price: ${stockData.current_price}</Text>
      <Text>Change: {stockData.change} ({stockData.percent_change}%)</Text>

      {stockData.chart && (
        <LineChart
          data={{
            labels: stockData.chart
              .filter((_, index, arr) => index % Math.floor(arr.length / 6) === 0)
              .map(p => {
                const date = new Date(p.date);
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                return `${day}.${month}`;
              }),
            datasets: [{ data: stockData.chart.map(p => p.close) }],
          }}
          width={Dimensions.get('window').width - 40}
          withVerticalLabels={true}
          withHorizontalLabels={true}
          height={220}
          withDots={false}
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            color: () => '#007AFF',
            labelColor: () => '#555',
            strokeWidth: 2,
            propsForBackgroundLines: {
              stroke: '#eee',
            },
          }}
          bezier
          style={{ marginTop: 20, borderRadius: 8 }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  errorText: { marginTop: 20, textAlign: 'center', color: 'red' },
});

export default StockDetailScreen;
