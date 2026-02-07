// utils/AssetUtils.js
import ApiService from "../services/ApiService";
import useAppStore from "../store/UseAppStore";
import { parseCongressDate } from "./DateUtils";

export default async function addAsset(item) {
    try {
        const ticker = item[0].split('\n')[0].trim();
        const endDateObj = parseCongressDate(item[3]);
        const dayAfterObj = new Date(endDateObj);
        dayAfterObj.setDate(dayAfterObj.getDate() -1);

        const endDate = endDateObj.toISOString().split("T")[0];
        const dayAfterEndDate = dayAfterObj.toISOString().split("T")[0];

        const stockInfo = await ApiService.get(
            `stocks/${ticker}?start=${dayAfterEndDate}&end=${endDate}`
        );

        const newAsset = {
          ticker,
          action: item[1].split('\n')[0],
          amount: item[1].split('\n')[1],
          person: item[2].split('\n')[0],
          transactionDate: item[3],
          reportedDate: item[4],
          comment: item[5],
          change: item[6],
          addedDate: new Date().toISOString().split("T")[0],
          chartData: stockInfo,
        };
        
        useAppStore.getState().addAsset(newAsset);

        //return true;
    }
    catch (error) {
        console.error("Error fetching stock info:", error);
        //return false;
    }
}
