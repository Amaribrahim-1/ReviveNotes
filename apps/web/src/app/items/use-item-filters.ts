"use client";

import type { ItemStatus, ItemType } from "@revivenotes/shared";
import { create } from "zustand";

type ItemFiltersState = {
  categoryId: string;
  status: ItemStatus | "";
  type: ItemType | "";
  tagIds: string[];
  setCategoryId: (categoryId: string) => void;
  setStatus: (status: ItemStatus | "") => void;
  setType: (type: ItemType | "") => void;
  toggleTag: (tagId: string) => void;
};

export const useItemFilters = create<ItemFiltersState>((set) => ({
  categoryId: "",
  status: "",
  type: "",
  tagIds: [],
  setCategoryId: (categoryId) => set({ categoryId }),
  setStatus: (status) => set({ status }),
  setType: (type) => set({ type }),
  toggleTag: (tagId) =>
    set((state) => ({
      tagIds: state.tagIds.includes(tagId)
        ? state.tagIds.filter((id) => id !== tagId)
        : [...state.tagIds, tagId],
    })),
}));
