import { create } from "zustand";

export type ToastVariant = "success" | "error" | "info";

interface ToastState {
  visible: boolean;
  message: string;
  variant: ToastVariant;
  showToast: (message: string, variant?: ToastVariant) => void;
  hideToast: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  visible: false,
  message: "",
  variant: "success",
  showToast: (message, variant = "success") =>
    set({ visible: true, message, variant }),
  hideToast: () => set({ visible: false }),
}));
