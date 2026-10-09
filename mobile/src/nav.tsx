import { createContext, useContext } from 'react';

export interface Nav {
  openRisk: (id: string) => void;
  openSettings: () => void;
  goTab: (tab: TabKey) => void;
  refresh: () => void;
}

export type TabKey = 'overview' | 'risks' | 'register' | 'actions' | 'add';

export const NavContext = createContext<Nav>({
  openRisk: () => {}, openSettings: () => {}, goTab: () => {}, refresh: () => {},
});

export const useNav = () => useContext(NavContext);
