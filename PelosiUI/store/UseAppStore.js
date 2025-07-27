// store/useAppStore.js
import { create } from 'zustand';

const useAppStore = create((set) => ({
  tempData: {},
  
  // Actions
  setTempData: (data) => set((state) => ({
    tempData: { ...state.tempData, ...data },
  })),
  clear: () => set({ tempData: {} }),
}));

export default useAppStore;
