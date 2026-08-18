import React from 'react';
import { AppProviders } from './providers';
import { AppShell } from '../components/layout/AppShell';

export const App: React.FC = () => {
  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  );
};
export default App;
