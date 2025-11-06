import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import ApiService from '../services/ApiService';

const StockDetailScreen = ({ route }) => {
  const { ticker, startDate, endDate } = route.params;
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(true);

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
  }, []);

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
