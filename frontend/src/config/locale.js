import { ConfigProvider } from 'antd';
import koKR from 'antd/locale/ko_KR';
import moment from 'moment';
import 'moment/locale/ko';

// 한국 시간대 및 로케일 설정
moment.locale('ko');
moment.tz?.setDefault('Asia/Seoul');

export const LocaleProvider = ({ children }) => (
  <ConfigProvider locale={koKR}>
    {children}
  </ConfigProvider>
);

// 날짜 포맷 유틸리티
export const formatDate = (date, format = 'YYYY년 MM월 DD일') => {
  if (!date) return '';
  return moment(date).format(format);
};

export const formatDateTime = (date, format = 'YYYY년 MM월 DD일 HH시 mm분') => {
  if (!date) return '';
  return moment(date).format(format);
};

export const getDaysUntilExpiry = (expiryDate) => {
  if (!expiryDate) return 0;
  const now = moment();
  const expiry = moment(expiryDate);
  return expiry.diff(now, 'days');
};

export const getExpiryStatus = (expiryDate) => {
  const daysLeft = getDaysUntilExpiry(expiryDate);
  
  if (daysLeft < 0) return { status: 'expired', text: '만료됨', color: 'red' };
  if (daysLeft === 0) return { status: 'today', text: '오늘 만료', color: 'orange' };
  if (daysLeft <= 7) return { status: 'warning', text: `${daysLeft}일 남음`, color: 'orange' };
  if (daysLeft <= 30) return { status: 'caution', text: `${daysLeft}일 남음`, color: 'yellow' };
  return { status: 'active', text: `${daysLeft}일 남음`, color: 'green' };
};