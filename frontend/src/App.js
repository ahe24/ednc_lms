import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LocaleProvider } from './config/locale';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LicenseManagement from './pages/LicenseManagement';
import FileUpload from './pages/FileUpload';
import './App.css';

function App() {
  return (
    <LocaleProvider>
      <BrowserRouter>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="licenses" element={<LicenseManagement />} />
              <Route path="upload" element={<FileUpload />} />
            </Route>
          </Routes>
        </div>
      </BrowserRouter>
    </LocaleProvider>
  );
}

export default App;