# 앱 구동 확인 가이드

## 빠른 확인 방법

### 1. 웹 브라우저로 접속 (가장 간단)
**개발 서버 URL**: https://3000-id2t922z2g8wj37uv5fbm-2e1b9533.sandbox.novita.ai

1. 위 URL을 웹 브라우저에 붙여넣기
2. 응급실 실시간 추천 시스템 페이지가 표시되는지 확인
3. 다음 요소들이 보이는지 확인:
   - 🏥 응급실 실시간 추천 시스템 (빨간색 제목)
   - 현재 위치 입력 폼
   - 위도/경도 입력 필드
   - 중증도 슬라이더 (1-10)
   - "현재 위치 가져오기" 버튼 (파란색)
   - "최적 응급실 찾기" 버튼 (빨간색)

### 2. 기능 테스트

#### 테스트 1: 현재 위치 가져오기
1. "현재 위치 가져오기" 버튼 클릭
2. 브라우저가 위치 권한 요청 → "허용" 클릭
3. 위도/경도 필드에 자동으로 값이 입력되는지 확인

#### 테스트 2: 수동 입력으로 응급실 검색
1. 위도: `37.5665` 입력
2. 경도: `126.9780` 입력
3. 중증도: 슬라이더를 `7`로 설정
4. "최적 응급실 찾기" 버튼 클릭
5. 결과 확인:
   - 로딩 스피너 표시
   - 5개 병원 목록이 점수 순으로 표시
   - 1위 병원에 금메달 아이콘과 빨간색 테두리
   - 각 병원의 정보 확인:
     - 가용 병상 / 전체 병상
     - 거리 (km)
     - 예상 시간 (분)
     - 추천 점수

#### 테스트 3: 중증도별 결과 비교
1. 동일한 위치에서 중증도를 변경하며 검색:
   - 중증도 1 (경증): 병상 가용률 중심 추천
   - 중증도 7 (고중증): 이동 시간 중심 추천
   - 중증도 10 (최고중증): 최단 시간 최우선
2. 추천 순위가 달라지는지 확인

## 개발자용 확인 방법

### 방법 1: PM2 상태 확인
```bash
cd /home/user/webapp
pm2 list
```

**예상 결과:**
```
┌────┬───────────────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┐
│ id │ name                  │ mode    │ pid     │ uptime   │ ↺      │ status    │
├────┼───────────────────────┼─────────┼─────────┼──────────┼────────┼───────────┤
│ 0  │ emergency-room-finder │ fork    │ 1405    │ 17m      │ 0      │ online    │
└────┴───────────────────────┴─────────┴─────────┴──────────┴────────┴───────────┘
```

- **status가 "online"**: ✅ 정상 작동
- **status가 "stopped"**: ❌ 서비스 중지됨 → 재시작 필요
- **status가 "errored"**: ❌ 오류 발생 → 로그 확인 필요

### 방법 2: 로그 확인
```bash
# 최근 로그 확인
pm2 logs emergency-room-finder --nostream --lines 50

# 실시간 로그 모니터링
pm2 logs emergency-room-finder
```

### 방법 3: API 엔드포인트 테스트

#### 메인 페이지 테스트
```bash
curl -s http://localhost:3000 | head -20
```

**예상 결과:** HTML 페이지 시작 부분이 표시됨
```html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>응급실 실시간 추천 시스템</title>
```

#### 응급실 목록 API 테스트
```bash
curl -s http://localhost:3000/api/emergency-rooms | python3 -m json.tool
```

**예상 결과:**
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
    "dataSource": "sample",
    "message": "API 키를 설정하면 실시간 데이터를 사용할 수 있습니다",
    "timestamp": "2025-10-29T14:37:15.295Z"
}
```

- `"success": true` → ✅ API 정상
- `"dataSource": "sample"` → 샘플 데이터 사용 중 (API 키 미설정)
- `"dataSource": "api"` → 공공데이터 API 연동 중

#### 추천 API 테스트
```bash
curl -s -X POST http://localhost:3000/api/recommend \
  -H "Content-Type: application/json" \
  -d '{"latitude": 37.5665, "longitude": 126.9780, "severity": 7}' \
  | python3 -m json.tool
```

**예상 결과:** 점수 순으로 정렬된 병원 목록
```json
{
    "success": true,
    "data": [
        {
            "id": "1",
            "name": "서울대학교병원",
            "distance": 2.8,
            "travelTime": 6,
            "score": 64
        }
    ],
    "severity": 7
}
```

### 방법 4: 서비스 재시작 (문제 발생 시)
```bash
cd /home/user/webapp

# 1. 기존 서비스 중지
pm2 delete emergency-room-finder

# 2. 포트 정리
fuser -k 3000/tcp 2>/dev/null || true

# 3. 빌드
npm run build

# 4. 재시작
pm2 start ecosystem.config.cjs

# 5. 상태 확인
pm2 list
```

## 트러블슈팅

### 문제 1: 웹페이지가 열리지 않음
**증상:** URL 접속 시 연결 거부 또는 타임아웃

**확인사항:**
```bash
# 1. 서비스 상태 확인
pm2 list

# 2. 포트 3000이 열려있는지 확인
lsof -i :3000

# 3. 로그 확인
pm2 logs emergency-room-finder --nostream
```

**해결방법:**
```bash
# 서비스 재시작
cd /home/user/webapp
pm2 restart emergency-room-finder

# 또는 완전 재시작
pm2 delete emergency-room-finder
npm run build
pm2 start ecosystem.config.cjs
```

### 문제 2: "최적 응급실 찾기" 버튼 클릭 시 오류
**증상:** 
- 버튼 클릭 후 아무 반응 없음
- 또는 오류 메시지 표시

**확인사항:**
```bash
# API 테스트
curl -X POST http://localhost:3000/api/recommend \
  -H "Content-Type: application/json" \
  -d '{"latitude": 37.5665, "longitude": 126.9780, "severity": 5}'
```

**해결방법:**
1. 브라우저 개발자도구 (F12) 열기
2. Console 탭에서 오류 메시지 확인
3. Network 탭에서 API 요청 상태 확인

### 문제 3: 데이터가 "sample"만 표시됨 (실시간 데이터 필요 시)
**증상:** 
```json
{
  "dataSource": "sample",
  "message": "API 키를 설정하면 실시간 데이터를 사용할 수 있습니다"
}
```

**해결방법:**
1. [API_SETUP_GUIDE.md](./API_SETUP_GUIDE.md) 참조
2. 공공데이터포털에서 API 키 발급
3. `.dev.vars` 파일에 API 키 설정
4. 서비스 재시작

### 문제 4: PM2가 설치되지 않음
**증상:** `pm2: command not found`

**해결방법:**
```bash
# PM2 전역 설치
npm install -g pm2

# 또는 npx 사용
cd /home/user/webapp
npx pm2 start ecosystem.config.cjs
```

## 성공 체크리스트

앱이 정상적으로 작동하면 다음 항목들이 모두 ✅ 이어야 한다:

- [ ] PM2 상태가 "online"
- [ ] 웹 브라우저에서 메인 페이지 접속 가능
- [ ] "현재 위치 가져오기" 기능 작동
- [ ] 위도/경도 수동 입력 가능
- [ ] 중증도 슬라이더 작동
- [ ] "최적 응급실 찾기" 클릭 시 결과 표시
- [ ] 5개 병원 정보가 점수 순으로 정렬되어 표시
- [ ] 각 병원의 가용병상, 거리, 시간, 점수 표시
- [ ] API 엔드포인트 `/api/emergency-rooms` 응답 정상
- [ ] API 엔드포인트 `/api/recommend` 응답 정상

## 추가 도구

### 브라우저 개발자도구 활용
**F12 또는 우클릭 > 검사**

1. **Console 탭**: JavaScript 오류 확인
2. **Network 탭**: API 요청/응답 확인
3. **Application 탭**: 로컬 저장소 확인
4. **Elements 탭**: HTML 구조 확인

### curl 대신 브라우저로 API 테스트
```
# JSON 뷰어 크롬 확장 프로그램 설치 후
https://3000-id2t922z2g8wj37uv5fbm-2e1b9533.sandbox.novita.ai/api/emergency-rooms
```

### Postman 또는 Insomnia 사용
API 테스트 전용 도구로 더 편리한 테스트 가능

## 문의 및 지원

- **GitHub Issues**: https://github.com/QtaeRoh/q-project/issues
- **README**: [README.md](./README.md)
- **API 가이드**: [API_SETUP_GUIDE.md](./API_SETUP_GUIDE.md)
