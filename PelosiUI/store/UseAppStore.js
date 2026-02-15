import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

const useAppStore = create(
  persist(
    (set) => ({
      tempData: {},
      myAssets: [],
      user: null,
      token: null,

      setAuth: ({ user, token }) =>
        set(() => ({
          user,
          token,
        })),

      logout: () =>
        set(() => ({
          user: null,
          token: null,
          myAssets: [],
        })),

      setTempData: (data) =>
        set((state) => ({
          tempData: { ...state.tempData, ...data },
        })),

      setMyAssets: (assets) =>
        set(() => ({
          myAssets: assets || [],
        })),

      addAsset: (asset) =>
        set((state) => ({
          myAssets: [...state.myAssets, asset],
        })),

      updateAsset: (updatedAsset) =>
        set((state) => ({
          myAssets: state.myAssets.map((a) =>
            a.ticker === updatedAsset.ticker ? { ...a, ...updatedAsset } : a
          ),
        })),

      removeAsset: (ticker) =>
        set((state) => ({
          myAssets: state.myAssets.filter(a => a.ticker !== ticker)
        })),


      clear: () => set({ tempData: {} }),
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useAppStore;
