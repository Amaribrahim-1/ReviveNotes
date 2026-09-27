"use client";

import type { ItemStatus, ItemType } from "@revivenotes/shared";
import { create } from "zustand";

type ItemFiltersState = {
  categoryId: string;
  status: ItemStatus | "";
  type: ItemType | "";
  setCategoryId: (categoryId: string) => void;
  setStatus: (status: ItemStatus | "") => void;
  setType: (type: ItemType | "") => void;
};

export const useItemFilters = create<ItemFiltersState>((set) => ({
  categoryId: "",
  status: "",
  type: "",
  setCategoryId: (categoryId) => set({ categoryId }),
  setStatus: (status) => set({ status }),
  setType: (type) => set({ type }),
}));
