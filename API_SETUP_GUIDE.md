# 공공데이터포털 API 설정 가이드

## 개요
본 프로젝트는 국립중앙의료원에서 제공하는 응급의료기관 정보 API를 사용하여 실시간 응급실 가용병상 정보를 조회한다.

## API 키 발급 절차

### 1단계: 공공데이터포털 회원가입
1. [공공데이터포털](https://www.data.go.kr/) 접속
2. 우측 상단 "회원가입" 클릭
3. 개인정보 입력 및 이메일 인증 완료

### 2단계: API 활용신청
1. [응급의료기관 정보 조회 서비스](https://www.data.go.kr/data/15000563/openapi.do) 접속
2. 페이지 중앙의 "활용신청" 버튼 클릭
3. 활용 목적 입력 예시:
   ```
   응급실 실시간 추천 시스템 개발
   - 사용자 위치 기반 최적 응급실 추천 서비스
   - 실시간 가용병상 정보 조회 및 분석
   ```
4. 신청 완료 후 승인 대기 (보통 즉시~수 시간 소요)

### 3단계: 인증키 확인
1. 승인 완료 후 마이페이지 접속
2. "오픈API" 또는 "개발계정" 메뉴 선택
3. 신청한 API의 인증키(serviceKey) 복사

## 로컬 개발 환경 설정

### 방법 1: .dev.vars 파일 사용 (권장)
```bash
# 프로젝트 루트 디렉토리에서
cp .dev.vars.example .dev.vars

# .dev.vars 파일 수정
EMERGENCY_API_KEY=발급받은_인증키
```

### 방법 2: 직접 파일 생성
```bash
# .dev.vars 파일 생성
echo "EMERGENCY_API_KEY=발급받은_인증키" > .dev.vars
```

### 테스트
```bash
# 개발 서버 시작
npm run build
pm2 start ecosystem.config.cjs

# API 호출 테스트
curl http://localhost:3000/api/emergency-rooms

# 응답에서 "dataSource": "api" 확인
# "dataSource": "sample"이면 API 키가 올바르게 설정되지 않은 것
```

## Production 환경 설정

### Cloudflare Pages 배포 시
```bash
# wrangler CLI 사용
wrangler pages secret put EMERGENCY_API_KEY --project-name emergency-room-finder

# 프롬프트에서 발급받은 인증키 입력
```

### Cloudflare Dashboard 사용
1. Cloudflare Dashboard 로그인
2. Pages 프로젝트 선택
3. Settings > Environment variables
4. "Add variable" 클릭
5. 변수 설정:
   - Name: `EMERGENCY_API_KEY`
   - Value: `발급받은_인증키`
   - Environment: Production (또는 Preview/Both)
6. "Save" 클릭
7. 재배포 필요 (자동 또는 수동)

## API 사용 제한 및 주의사항

### 트래픽 제한
- 일일 호출 제한: 10,000건 (기본)
- 트래픽 초과 시: 응답 속도 저하 또는 차단
- 해결방법: 
  - 데이터 캐싱 구현 (Cloudflare D1 또는 KV)
  - 트래픽 증가 신청 (공공데이터포털)

### 응답 시간
- 평균 응답 시간: 1-3초
- 타임아웃 설정 권장: 10초

### 데이터 업데이트 주기
- 실시간 가용병상: 5-10분 간격 업데이트
- 병원 기본정보: 일 단위 업데이트

## 트러블슈팅

### 문제: "dataSource": "sample" 계속 반환
**원인:**
- API 키가 설정되지 않음
- API 키가 잘못됨
- 환경변수가 로드되지 않음

**해결:**
```bash
# 1. .dev.vars 파일 확인
cat .dev.vars

# 2. API 키 형식 확인 (URL 인코딩 여부)
# 올바른 형식: EMERGENCY_API_KEY=abc123def456...
# 잘못된 형식: EMERGENCY_API_KEY=abc%2B123... (인코딩된 상태)

# 3. wrangler 재시작
pm2 delete emergency-room-finder
npm run build
pm2 start ecosystem.config.cjs
```

### 문제: API 호출 실패 또는 오류
**원인:**
- API 키 미승인 또는 만료
- 트래픽 제한 초과
- API 서버 장애

**해결:**
1. 공공데이터포털 마이페이지에서 API 상태 확인
2. 승인 상태 확인 (대기중/승인/거부)
3. 트래픽 사용량 확인
4. 샘플 데이터 폴백 확인 (자동 전환되어야 함)

### 문제: CORS 오류
**원인:**
- API 엔드포인트가 CORS를 지원하지 않음

**해결:**
- 이미 구현됨: 백엔드에서 API 호출 후 프론트엔드에 전달
- 프론트엔드에서 직접 API 호출 불가 (보안상 올바른 구조)

## API 응답 데이터 구조

### 공공데이터포털 API 원본 응답
```json
{
  "response": {
    "header": {
      "resultCode": "00",
      "resultMsg": "NORMAL SERVICE."
    },
    "body": {
      "items": {
        "item": [
          {
            "hpid": "병원ID",
            "dutyName": "병원명",
            "dutyAddr": "주소",
            "dutyTel1": "전화번호",
            "wgs84Lat": "위도",
            "wgs84Lon": "경도",
            "hvec": "가용 응급실 병상 수",
            "hvoc": "사용 중 응급실 병상 수"
          }
        ]
      },
      "numOfRows": 10,
      "pageNo": 1,
      "totalCount": 100
    }
  }
}
```

### 변환된 응답 (애플리케이션)
```json
{
  "success": true,
  "data": [
    {
      "id": "병원ID",
      "name": "병원명",
      "address": "주소",
      "latitude": 37.5665,
      "longitude": 126.9780,
      "availableBeds": 5,
      "totalBeds": 20,
      "phone": "02-1234-5678"
    }
  ],
  "dataSource": "api",
  "timestamp": "2025-10-29T14:00:00.000Z"
}
```

## 참고 자료
- [공공데이터포털](https://www.data.go.kr/)
- [응급의료기관 정보 조회 API 문서](https://www.data.go.kr/data/15000563/openapi.do)
- [Cloudflare Pages 환경변수 가이드](https://developers.cloudflare.com/pages/platform/build-configuration/#environment-variables)
- [wrangler CLI 문서](https://developers.cloudflare.com/workers/wrangler/)
