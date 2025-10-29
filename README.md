# 응급실 실시간 추천 시스템

## 프로젝트 개요
- **이름**: 응급실 실시간 추천 시스템 (Emergency Room Finder)
- **목표**: 사용자의 현재 위치와 중증도를 기반으로 최적의 응급실을 실시간으로 추천한다
- **주요 기능**:
  - 사용자 위치(위도/경도) 입력 및 자동 감지
  - 중증도 레벨(1-10) 선택
  - 응급실 가용병상 실시간 조회
  - 병원까지의 거리 및 예상 소요시간 계산
  - 추천 점수 기반 최적 병원 정렬 및 출력

## URL
- **개발 환경**: https://3000-id2t922z2g8wj37uv5fbm-2e1b9533.sandbox.novita.ai
- **Production**: (배포 후 업데이트 예정)
- **GitHub**: (저장소 생성 후 업데이트 예정)

## 데이터 아키텍처

### 데이터 모델
```typescript
interface EmergencyRoom {
  id: string;              // 병원 고유 ID
  name: string;            // 병원명
  address: string;         // 주소
  latitude: number;        // 위도
  longitude: number;       // 경도
  availableBeds: number;   // 가용 병상 수
  totalBeds: number;       // 전체 병상 수
  phone: string;           // 전화번호
  distance?: number;       // 사용자로부터의 거리 (km)
  travelTime?: number;     // 예상 소요시간 (분)
  score?: number;          // 추천 점수 (0-100)
}
```

### 저장소 서비스
- **현재**: 샘플 데이터 (메모리 기반)
- **계획**: Cloudflare D1 데이터베이스 또는 실시간 크롤링 시스템

### 데이터 흐름
1. 사용자가 위치(위도/경도)와 중증도를 입력한다
2. `/api/emergency-rooms` 엔드포인트에서 응급실 목록을 가져온다
3. 각 병원까지의 거리를 Haversine 공식으로 계산한다
4. 평균 속도(30km/h)로 예상 소요시간을 계산한다
5. 추천 알고리즘으로 각 병원의 점수를 산출한다
6. 점수 순으로 정렬하여 결과를 반환한다

## 추천 알고리즘

### 점수 계산 로직
추천 점수는 중증도, 가용병상률, 이동시간을 종합적으로 고려하여 0-100점으로 계산된다.

#### 1. 병상 가용률 (Bed Availability)
```
bedAvailability = availableBeds / totalBeds
```

#### 2. 시간 점수 (Time Score)
```
timeScore = max(0, 1 - (travelTime / 60분))
```
- 시간이 짧을수록 높은 점수
- 60분 이상은 0점 처리

#### 3. 중증도별 가중치

**고중증도 (7-10점)**
- 시간 60% + 병상 40%
- 빠른 이송이 가장 중요하므로 시간 가중치를 높인다

**중등도 (4-6점)**
- 시간 50% + 병상 50%
- 균형있게 고려한다

**경증 (1-3점)**
- 시간 40% + 병상 60%
- 병상 가용성을 더 중요하게 고려한다

#### 4. 최종 점수
```
if (중증도 >= 7) {
  finalScore = timeScore × 0.6 + bedScore × 0.4
} else if (중증도 >= 4) {
  finalScore = timeScore × 0.5 + bedScore × 0.5
} else {
  finalScore = timeScore × 0.4 + bedScore × 0.6
}

return round(finalScore × 100)  // 0-100점
```

## 사용자 가이드

### 1. 위치 정보 입력
- **자동 감지**: "현재 위치 가져오기" 버튼을 클릭하면 브라우저의 GPS를 통해 자동으로 위치를 감지한다
- **수동 입력**: 위도와 경도를 직접 입력할 수 있다 (예: 서울시청 - 위도 37.5665, 경도 126.9780)

### 2. 중증도 선택
- 슬라이더를 사용하여 1~10 사이의 중증도를 선택한다
- 1-3: 경증 (녹색)
- 4-7: 중등도 (노란색)
- 8-10: 중증 (빨간색)

### 3. 결과 확인
- "최적 응급실 찾기" 버튼을 클릭한다
- 추천 점수가 높은 순서로 병원 목록이 표시된다
- 각 병원의 정보를 확인한다:
  - 가용 병상 수 / 전체 병상 수
  - 거리 (km)
  - 예상 소요시간 (분)
  - 추천 점수 (0-100점)

## API 엔드포인트

### GET /api/emergency-rooms
응급실 목록을 조회한다.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "서울대학교병원",
      "address": "서울특별시 종로구 대학로 101",
      "latitude": 37.5826,
      "longitude": 127.0018,
      "availableBeds": 5,
      "totalBeds": 20,
      "phone": "02-2072-2114"
    }
  ],
  "timestamp": "2025-01-15T12:34:56.789Z"
}
```

### POST /api/recommend
사용자 위치와 중증도를 기반으로 추천 병원 목록을 반환한다.

**Request:**
```json
{
  "latitude": 37.5665,
  "longitude": 126.9780,
  "severity": 7
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "서울대학교병원",
      "address": "서울특별시 종로구 대학로 101",
      "latitude": 37.5826,
      "longitude": 127.0018,
      "availableBeds": 5,
      "totalBeds": 20,
      "phone": "02-2072-2114",
      "distance": 2.3,
      "travelTime": 5,
      "score": 85
    }
  ],
  "userLocation": {
    "latitude": 37.5665,
    "longitude": 126.9780
  },
  "severity": 7,
  "timestamp": "2025-01-15T12:34:56.789Z"
}
```

## 완료된 기능
- ✅ 사용자 위치 입력 (GPS 자동 감지 / 수동 입력)
- ✅ 중증도 선택 (1-10 스케일, 시각적 피드백)
- ✅ 응급실 데이터 조회 API
- ✅ 거리 계산 (Haversine 공식)
- ✅ 예상 소요시간 계산 (평균 속도 30km/h)
- ✅ 추천 점수 알고리즘 (중증도별 가중치 적용)
- ✅ 결과 정렬 및 출력 (순위별 시각적 강조)
- ✅ 반응형 UI (모바일/데스크톱 대응)

## 미완료 기능
- ⏳ 실시간 응급실 정보 크롤링
  - 현재: 샘플 데이터 사용
  - 계획: https://mediboard.nemc.or.kr/emergency_room_in_hand 사이트 크롤링
  - 제약: Cloudflare Workers에서 Puppeteer/Playwright 직접 사용 불가
  - 대안: 외부 크롤링 서비스 연동 또는 공공데이터 API 활용
- ⏳ 실시간 교통정보 연동
  - 현재: 평균 속도(30km/h) 기반 예상 시간
  - 계획: Google Maps API 또는 카카오내비 API 연동
- ⏳ 병원 상세정보 및 리뷰
- ⏳ 즐겨찾기 및 최근 검색 기록

## 권장 다음 단계
1. **실시간 데이터 수집**
   - Browserless API 또는 ScrapingBee 같은 서버리스 크롤링 서비스 연동
   - 또는 공공데이터포털 응급의료정보 API 활용
   
2. **교통정보 연동**
   - Google Maps Directions API 또는 카카오모빌리티 API 연동
   - 실시간 교통 상황을 반영한 정확한 이동시간 제공

3. **Cloudflare D1 데이터베이스 구축**
   - 응급실 기본정보 영구 저장
   - 크롤링 데이터 캐싱으로 성능 향상

4. **알림 기능**
   - 선택한 병원으로의 네비게이션 링크 제공
   - 전화 연결 원터치 기능

## 배포 상태
- **플랫폼**: Cloudflare Pages
- **상태**: ✅ 개발 환경 실행 중
- **기술 스택**: Hono + TypeScript + Tailwind CSS
- **최종 업데이트**: 2025-10-29
