import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { initTelegramWebApp } from './lib/telegram';
import { Splash } from './pages/Splash.tsx';
import { Welcome } from './pages/Welcome.tsx';
import { Radio } from './pages/Radio.tsx';
import { Admin } from './pages/Admin.tsx';

function App() {
  useEffect(() => {
    initTelegramWebApp();
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/radio" element={<Radio />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
