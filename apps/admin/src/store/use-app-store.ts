import { create } from 'zustand';

export type NavigationTab =
  | 'overview'
  | 'live-map'
  | 'worksites'
  | 'attendance'
  | 'organizations'
  | 'telemetry';

interface AppState {
  activeTab: NavigationTab;
  isSidebarOpen: boolean;
  activeToken: string | null;
  setActiveTab: (tab: NavigationTab) => void;
  setActiveToken: (token: string | null) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'overview',
  isSidebarOpen: true,
  activeToken: null,
  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveToken: (token) => set({ activeToken: token }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
}));
