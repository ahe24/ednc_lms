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

// 혼합 만료 상태 처리 함수
export const getMixedExpiryStatus = (license) => {
  const {
    expired_count = 0,
    expiring_today_count = 0,
    expiring_week_count = 0,
    expiring_month_count = 0,
    active_count = 0,
    feature_count = 0
  } = license;

  const total = feature_count;
  
  // 우선순위: 만료됨 > 오늘 만료 > 7일 내 만료 > 30일 내 만료 > 활성
  if (expired_count > 0) {
    const activeFeatures = total - expired_count;
    const isCompletelyExpired = expired_count === total;
    
    return {
      status: 'expired',
      icon: isCompletelyExpired ? '🔴' : '🟠',
      text: isCompletelyExpired ? '전체 만료' : '부분 만료',
      description: `${expired_count}/${total} 만료됨`,
      color: isCompletelyExpired ? 'red' : 'orange',
      tooltip: isCompletelyExpired 
        ? `모든 피처가 만료되었습니다 (${expired_count}개)`
        : `만료: ${expired_count}개, 활성: ${activeFeatures}개`
    };
  }
  
  if (expiring_today_count > 0) {
    const isAllExpiringToday = expiring_today_count === total;
    return {
      status: 'today',
      icon: isAllExpiringToday ? '🔴' : '🟡',
      text: isAllExpiringToday ? '전체 오늘 만료' : '부분 오늘 만료',
      description: `${expiring_today_count}/${total} 오늘 만료`,
      color: isAllExpiringToday ? 'red' : 'yellow',
      tooltip: isAllExpiringToday
        ? `모든 피처가 오늘 만료됩니다 (${expiring_today_count}개)`
        : `오늘 만료: ${expiring_today_count}개, 기타: ${total - expiring_today_count}개`
    };
  }
  
  const totalExpiring = expiring_week_count + expiring_month_count;
  if (totalExpiring > 0) {
    const isAllExpiring = totalExpiring === total;
    return {
      status: 'expiring',
      icon: isAllExpiring ? '🟡' : '🔵',
      text: isAllExpiring ? '전체 만료 임박' : '부분 만료 임박',
      description: `${totalExpiring}/${total} 만료 임박`,
      color: isAllExpiring ? 'yellow' : 'blue',
      tooltip: isAllExpiring
        ? `모든 피처가 만료 임박입니다 (7일 내: ${expiring_week_count}개, 30일 내: ${expiring_month_count}개)`
        : `7일 내: ${expiring_week_count}개, 30일 내: ${expiring_month_count}개, 활성: ${active_count}개`
    };
  }
  
  // 모든 피처가 활성 상태
  return {
    status: 'active',
    icon: '🟢',
    text: `전체 활성`,
    description: `${total}/${total} 활성`,
    color: 'green',
    tooltip: `모든 피처가 활성 상태입니다`
  };
};