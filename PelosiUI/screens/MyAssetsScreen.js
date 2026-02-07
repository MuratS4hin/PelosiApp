import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Modal
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
  const [showConfirm, setShowConfirm] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState(null);

  useEffect(() => {
    const fetchTrades = async () => {
      setLoading(true);

      try {
        // const bodyData = myAssets
        //   .filter(asset => asset.LastSoldDate == null)
        //   .map(asset => ({
        //     ticker: asset.ticker,
        //     politician: asset.person
        //   }));

        // if (bodyData.length === 0) {
        //   setLoading(false);
        //   return;
        // }

        // const response = await ApiService.post(
        //   'congresstrades/find_same_politician_same_stock_type',
        //   bodyData
        // );

      } catch (error) {
        console.error("Error fetching trades:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

    fetchTrades();
  }, []);

  const confirmDelete = (ticker) => {
    setAssetToDelete(ticker);
    setShowConfirm(true);
  };

  const deleteAsset = () => {
    removeAsset(assetToDelete);
    setShowConfirm(false);
    setAssetToDelete(null);
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

      {/* DELETE CONFIRM POPUP */}
      <Modal
        visible={showConfirm}
        transparent
        animationType="fade"
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalBox}>
            <Text style={styles.modalText}>Are you sure you want to delete?</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#ff4444" }]}
                onPress={deleteAsset}
              >
                <Text style={styles.modalBtnText}>Yes</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#aaa" }]}
                onPress={() => setShowConfirm(false)}
              >
                <Text style={styles.modalBtnText}>No</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 10,
    width: "80%",
  },
  modalText: {
    fontSize: 16,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    marginTop: 20,
    justifyContent: "space-around",
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  modalBtnText: {
    color: "#FFF",
    fontSize: 16,
  },
});
