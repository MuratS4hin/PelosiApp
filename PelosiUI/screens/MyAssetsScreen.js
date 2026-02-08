import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import UseAppStore from '../store/UseAppStore';
import ApiService from '../services/ApiService';
import Icon from "react-native-vector-icons/MaterialCommunityIcons";


const MyAssetsScreen = () => {
  const navigation = useNavigation();
  const myAssets = UseAppStore((s) => s.myAssets);
  const removeAsset = UseAppStore((s) => s.removeAsset); // 🔥 delete function
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const confirmDelete = (ticker) => {
    Alert.alert(
      'Remove from List',
      `Do you want to remove ${ticker} from your list?`,
      [
        { text: 'No', onPress: () => {}, style: 'cancel' },
        { text: 'Yes', onPress: () => removeAsset(ticker), style: 'destructive' }
      ]
    );
  };

  const renderItem = ({ item }) => {
    const {
      ticker,
      person,
      action,
      amount,
      transactionDate,
      reportedDate,
      comment,
      change,
      chartData,
      addedDate
    } = item;

    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

    const startDate = new Date(addedDate) >= fifteenDaysAgo
      ? fifteenDaysAgo.toISOString().slice(0, 10)
      : addedDate;

    const companyName = chartData?.company_name || ticker;
    const percentChange = chartData?.percent_change ?? "N/A";

    return (
      <View style={styles.card}>
        {/* CONTENT AREA */}
        <TouchableOpacity
          style={styles.cardContent}
          onPress={() =>
            navigation.navigate("StockDetail", {
              ticker,
              startDate: startDate,
              endDate: new Date().toISOString().slice(0, 10),
            })
          }
        >
          <Text style={styles.ticker}>{companyName} ({ticker})</Text>
          <Text style={styles.details}>{action} — {amount}</Text>
          <Text style={styles.details}>By {person}</Text>
          <Text style={styles.details}>Transaction: {transactionDate}</Text>
          <Text style={styles.details}>Reported: {reportedDate}</Text>
          <Text style={styles.details}>
            Change: {change} | Stock: {percentChange}%
          </Text>

          {comment && comment !== "-" && (
            <Text style={styles.comment}>Note: {comment}</Text>
          )}
        </TouchableOpacity>

        {/* DELETE BUTTON */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => confirmDelete(ticker)}
        >
          <Icon name="trash-can-outline" size={24} color="#958a8a" />
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!myAssets.length) {
    return (
      <View style={styles.centered}>
        <Text>No assets added yet.</Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={myAssets}
        keyExtractor={(item, i) => i.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        refreshing={refreshing}
        onRefresh={() => setRefreshing(true)}
      />

    </>
  );
};

export default MyAssetsScreen;

const styles = StyleSheet.create({
  listContainer: {
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    position: "relative",
  },
  cardContent: {
    flex: 1,
    paddingRight: 20,
  },
  deleteBtn: {
    position: "absolute",
    right: 4,
    top: 4,
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteBtnText: {
    fontSize: 20,
  },
  ticker: {
    fontSize: 18,
    fontWeight: "bold",
  },
  details: {
    marginTop: 4,
    fontSize: 14,
  },
  comment: {
    marginTop: 4,
    fontStyle: "italic",
    color: "#555",
  },
});
