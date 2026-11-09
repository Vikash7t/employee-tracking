import { create } from 'zustand';

interface AppState {
  activeTab: 'overview' | 'organizations' | 'worksites' | 'telemetry';
  isSidebarOpen: boolean;
  setActiveTab: (tab: 'overview' | 'organizations' | 'worksites' | 'telemetry') => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'overview',
  isSidebarOpen: true,
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
}));
