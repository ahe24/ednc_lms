import axios from 'axios';

const API_CONFIG = {
  baseURL: process.env.REACT_APP_API_BASE_URL || `http://${window.location.hostname}:3601`,
  timeout: 10000
};

export const apiClient = axios.create(API_CONFIG);

// 요청 인터셉터 - 토큰 자동 추가
apiClient.interceptors.request.use(
  config => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터 - 401 오류시 자동 로그아웃
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;