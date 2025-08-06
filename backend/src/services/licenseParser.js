const moment = require('moment-timezone');

moment.tz.setDefault('Asia/Seoul');

class LicenseParser {
    static parseLicenseFile(fileContent) {
        const result = {
            siteInfo: {},
            partInfo: {},
            features: []
        };
        
        try {
            // Site 정보 추출 (더 유연한 패턴)
            const siteMatch = fileContent.match(/# (.+)\s+Site # :(\d+)=(.+)/) || 
                             fileContent.match(/Site # :(\d+)/) ||
                             fileContent.match(/SITE # :(\d+)/);
            
            if (siteMatch) {
                if (siteMatch.length >= 4) {
                    result.siteInfo = {
                        siteName: siteMatch[1].trim(),
                        siteNumber: siteMatch[2],
                        fullSiteName: siteMatch[3].trim()
                    };
                } else {
                    result.siteInfo = {
                        siteName: 'Unknown Site',
                        siteNumber: siteMatch[1],
                        fullSiteName: 'Unknown Corporation'
                    };
                }
            }
            
            // Host ID 추출 (더 유연한 패턴)
            const hostIdMatch = fileContent.match(/HOSTID=FLEXID=([^\s]+)/) ||
                               fileContent.match(/HOSTID=([^\s]+)/) ||
                               fileContent.match(/HOST=([^\s]+)/) ||
                               fileContent.match(/SERVER\s+[^\s]+\s+([A-F0-9]{12})\s+\d+/);
            
            if (hostIdMatch) {
                result.siteInfo.hostId = hostIdMatch[1];
            }
            
            // License Content 섹션에서 Part 정보 및 Feature 추출
            const contentSection = this.extractLicenseContent(fileContent);
            if (contentSection) {
                result.partInfo = this.parsePartInfo(contentSection);
                result.features = this.parseFeatures(contentSection);
            }
            
            return result;
        } catch (error) {
            console.error('라이센스 파일 파싱 오류:', error);
            throw new Error(`라이센스 파일 파싱 실패: ${error.message}`);
        }
    }
    
    static extractLicenseContent(fileContent) {
        const startMarker = "############################# License Content #############################";
        const endMarker = "######################### End of License Content ##########################";
        
        const startIndex = fileContent.indexOf(startMarker);
        const endIndex = fileContent.indexOf(endMarker);
        
        if (startIndex === -1 || endIndex === -1) {
            // 대체 마커 검색
            const altStartMarker = "License Content";
            const altEndMarker = "End of License Content";
            
            const altStartIndex = fileContent.indexOf(altStartMarker);
            const altEndIndex = fileContent.indexOf(altEndMarker);
            
            if (altStartIndex === -1 || altEndIndex === -1) {
                throw new Error("License Content 섹션을 찾을 수 없습니다");
            }
            
            return fileContent.substring(altStartIndex, altEndIndex);
        }
        
        return fileContent.substring(startIndex, endIndex);
    }
    
    static parsePartInfo(contentSection) {
        // Part 정보 패턴: # 숫자 제품명 숫자
        const partMatch = contentSection.match(/# (\d+)\s+(.+?)\s+(\d+)/);
        if (partMatch) {
            return {
                partNumber: partMatch[1],
                partName: partMatch[2].trim(),
                quantity: partMatch[3]
            };
        }
        
        // 대체 패턴 검색
        const altPartMatch = contentSection.match(/Part Number[:\s]*(\d+)/i);
        const altNameMatch = contentSection.match(/Product[:\s]*(.+)/i);
        
        if (altPartMatch || altNameMatch) {
            return {
                partNumber: altPartMatch ? altPartMatch[1] : '',
                partName: altNameMatch ? altNameMatch[1].trim() : '',
                quantity: '1'
            };
        }
        
        return {};
    }
    
    static parseFeatures(contentSection) {
        const features = [];
        
        // 메인 패턴: # 피처명 버전 시작일 만료일 시리얼번호
        const featureRegex = /#\s+(\w+)\s+([\d.]+)\s+(\d{2}\s+\w{3}\s+\d{4})\s+(\d{2}\s+\w{3}\s+\d{4})\s+(\d+)/g;
        
        let match;
        while ((match = featureRegex.exec(contentSection)) !== null) {
            features.push({
                featureName: match[1],
                version: match[2],
                startDate: this.parseDate(match[3]),
                expiryDate: this.parseDate(match[4]),
                serialNumber: match[5]
            });
        }
        
        // 대체 패턴: INCREMENT 라인 파싱
        if (features.length === 0) {
            const incrementRegex = /INCREMENT\s+(\w+)\s+[\w\d]+\s+([\d.]+)\s+(\d{2}-\w{3}-\d{4})/g;
            while ((match = incrementRegex.exec(contentSection)) !== null) {
                features.push({
                    featureName: match[1],
                    version: match[2],
                    startDate: this.parseDate(match[3]),
                    expiryDate: this.parseDate(match[3]), // 기본값으로 시작일과 동일
                    serialNumber: ''
                });
            }
        }
        
        return features;
    }
    
    static parseDate(dateStr) {
        const months = {
            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
            'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
            'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12',
            'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
            'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
            'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
        };
        
        // 공백으로 구분된 형식: "04 Aug 2025"
        let parts = dateStr.split(' ');
        if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = months[parts[1]];
            const year = parts[2];
            if (month) {
                return `${year}-${month}-${day}`;
            }
        }
        
        // 하이픈으로 구분된 형식: "03-sep-2025"
        parts = dateStr.split('-');
        if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = months[parts[1]];
            const year = parts[2];
            if (month) {
                return `${year}-${month}-${day}`;
            }
        }
        
        // 기본값으로 현재 날짜 반환
        console.warn(`날짜 파싱 실패: ${dateStr}, 현재 날짜 사용`);
        return moment().format('YYYY-MM-DD');
    }
    
    // 라이센스 상태 계산
    static calculateLicenseStatus(expiryDate) {
        const today = moment();
        const expiry = moment(expiryDate);
        const daysUntilExpiry = expiry.diff(today, 'days');
        
        if (daysUntilExpiry < 0) {
            return { status: 'EXPIRED', daysLeft: daysUntilExpiry, color: 'red' };
        } else if (daysUntilExpiry === 0) {
            return { status: 'EXPIRES_TODAY', daysLeft: 0, color: 'orange' };
        } else if (daysUntilExpiry <= 7) {
            return { status: 'EXPIRES_SOON', daysLeft: daysUntilExpiry, color: 'orange' };
        } else if (daysUntilExpiry <= 30) {
            return { status: 'EXPIRES_WARNING', daysLeft: daysUntilExpiry, color: 'yellow' };
        } else {
            return { status: 'ACTIVE', daysLeft: daysUntilExpiry, color: 'green' };
        }
    }
    
    // 파일 유효성 검사 (더 유연한 버전)
    static validateLicenseFile(fileContent) {
        const errors = [];
        
        if (!fileContent || fileContent.trim().length === 0) {
            errors.push('파일이 비어있습니다');
            return { isValid: false, errors };
        }
        
        // 더 유연한 라이센스 파일 패턴 확인
        const hasSiteInfo = fileContent.includes('Site') || fileContent.includes('SITE') || fileContent.includes('site');
        const hasHostId = fileContent.includes('HOSTID') || fileContent.includes('hostid') || fileContent.includes('Host') || fileContent.includes('HOST') || fileContent.includes('SERVER');
        const hasLicenseContent = fileContent.includes('License') || fileContent.includes('INCREMENT') || fileContent.includes('FEATURE') || fileContent.includes('license') || fileContent.includes('increment') || fileContent.includes('feature');
        
        // 추가적인 Siemens 라이센스 패턴들
        const hasSiemensPattern = fileContent.includes('Siemens') || fileContent.includes('siemens') || fileContent.includes('SIMATIC') || fileContent.includes('simatic');
        const hasDatePattern = /\d{2}-\w{3}-\d{4}/.test(fileContent) || /\d{4}-\d{2}-\d{2}/.test(fileContent);
        const hasSerialPattern = /\d{12}/.test(fileContent) || /\d{10}/.test(fileContent);
        
        // 최소한 하나의 라이센스 관련 패턴이 있는지 확인
        const hasAnyLicensePattern = hasSiteInfo || hasHostId || hasLicenseContent || hasSiemensPattern || hasDatePattern || hasSerialPattern;
        
        if (!hasAnyLicensePattern) {
            errors.push('유효한 라이센스 파일 형식이 아닙니다. 라이센스 관련 정보를 찾을 수 없습니다.');
        }
        
        // 파일이 너무 짧은 경우 경고
        if (fileContent.length < 50) {
            errors.push('파일이 너무 짧습니다. 유효한 라이센스 파일인지 확인해주세요.');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    // 라이센스 요약 정보 생성
    static generateLicenseSummary(parsedData) {
        const summary = {
            siteInfo: parsedData.siteInfo,
            partInfo: parsedData.partInfo,
            totalFeatures: parsedData.features.length,
            featuresByStatus: {
                active: 0,
                expiring: 0,
                expired: 0
            },
            earliestExpiry: null,
            latestExpiry: null
        };
        
        parsedData.features.forEach(feature => {
            const status = this.calculateLicenseStatus(feature.expiryDate);
            
            if (status.status === 'EXPIRED') {
                summary.featuresByStatus.expired++;
            } else if (['EXPIRES_TODAY', 'EXPIRES_SOON', 'EXPIRES_WARNING'].includes(status.status)) {
                summary.featuresByStatus.expiring++;
            } else {
                summary.featuresByStatus.active++;
            }
            
            // 가장 빠른/늦은 만료일 추적
            if (!summary.earliestExpiry || moment(feature.expiryDate).isBefore(summary.earliestExpiry)) {
                summary.earliestExpiry = feature.expiryDate;
            }
            if (!summary.latestExpiry || moment(feature.expiryDate).isAfter(summary.latestExpiry)) {
                summary.latestExpiry = feature.expiryDate;
            }
        });
        
        return summary;
    }
}

module.exports = LicenseParser;