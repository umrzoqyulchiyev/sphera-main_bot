import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { initTelegramWebApp } from './lib/telegram';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Splash } from './pages/Splash.tsx';
import { Welcome } from './pages/Welcome.tsx';
import { Radio } from './pages/Radio.tsx';
import { Admin } from './pages/Admin.tsx';
import { Toast } from './components/ui/Toast';
import { useToast } from './hooks/useToast';
import { useLiveBroadcast } from './hooks/useLiveBroadcast';
import { DEFAULT_CITY, LS_CITY } from './lib/config';

function App() {
  useEffect(() => {
    initTelegramWebApp();
  }, []);

  // Efir (mikrofon) holati Router darajasidan HAM yuqorida ushlanadi —
  // /radio va /admin alohida route'lar, ular orasida almashish <Radio/>ni
  // butunlay qayta mount qiladi. Radio.tsx darajasidagi lift (avvalgi
  // fix — faqat ichki tablar uchun) buni qamrab olmaydi: admin efirga
  // chiqib, admin-panelga o'tsa, MediaRecorder/stream yo'qolib, serverda
  // sessiya "band" holida osilib qolardi — qaytganda "Broadcast busy".
  const [city] = useState(localStorage.getItem(LS_CITY) || DEFAULT_CITY);
  const { message: liveToast, showToast: showLiveToast } = useToast();
  const liveBroadcast = useLiveBroadcast(city, showLiveToast);

  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/radio" element={<Radio liveBroadcast={liveBroadcast} />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
      <Toast message={liveToast} />
    </ErrorBoundary>
  );
}

export default App;
