import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

const app = new Hono()

// CORS 활성화
app.use('/api/*', cors())

// 정적 파일 제공
app.use('/static/*', serveStatic({ root: './public' }))

// 응급실 데이터 타입 정의
interface EmergencyRoom {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  availableBeds: number;
  totalBeds: number;
  phone: string;
  distance?: number;
  travelTime?: number;
  score?: number;
}

// 응급실 실시간 정보 크롤링 API (샘플 데이터)
app.get('/api/emergency-rooms', async (c) => {
  // TODO: 실제로는 https://mediboard.nemc.or.kr/emergency_room_in_hand 크롤링
  // 현재는 샘플 데이터 반환
  const sampleData: EmergencyRoom[] = [
    {
      id: '1',
      name: '서울대학교병원',
      address: '서울특별시 종로구 대학로 101',
      latitude: 37.5826,
      longitude: 127.0018,
      availableBeds: 5,
      totalBeds: 20,
      phone: '02-2072-2114'
    },
    {
      id: '2',
      name: '세브란스병원',
      address: '서울특별시 서대문구 연세로 50-1',
      latitude: 37.5626,
      longitude: 126.9409,
      availableBeds: 3,
      totalBeds: 15,
      phone: '02-2228-5800'
    },
    {
      id: '3',
      name: '삼성서울병원',
      address: '서울특별시 강남구 일원로 81',
      latitude: 37.4885,
      longitude: 127.0857,
      availableBeds: 8,
      totalBeds: 25,
      phone: '02-3410-2114'
    },
    {
      id: '4',
      name: '서울아산병원',
      address: '서울특별시 송파구 올림픽로 43길 88',
      latitude: 37.5269,
      longitude: 127.1087,
      availableBeds: 2,
      totalBeds: 18,
      phone: '02-3010-3000'
    },
    {
      id: '5',
      name: '강남세브란스병원',
      address: '서울특별시 강남구 언주로 211',
      latitude: 37.5195,
      longitude: 127.0473,
      availableBeds: 6,
      totalBeds: 22,
      phone: '02-2019-3000'
    }
  ];

  return c.json({
    success: true,
    data: sampleData,
    timestamp: new Date().toISOString()
  });
});

// 추천 알고리즘: 중증도, 가용병상, 거리를 고려한 점수 계산
function calculateRecommendationScore(
  severity: number,
  availableBeds: number,
  totalBeds: number,
  travelTime: number
): number {
  // 병상 가용률 (0-1)
  const bedAvailability = availableBeds / totalBeds;
  
  // 중증도에 따른 가중치
  // 중증도가 높을수록 병상 가용성과 시간이 더 중요
  const severityWeight = severity / 10;
  
  // 시간 점수 (분 단위, 최대 60분 기준)
  // 시간이 짧을수록 높은 점수
  const timeScore = Math.max(0, 1 - (travelTime / 60));
  
  // 병상 점수 (가용 병상이 많을수록 높은 점수)
  const bedScore = bedAvailability;
  
  // 종합 점수 계산
  // 중증도가 높을수록 시간과 병상의 가중치가 높아짐
  let finalScore = 0;
  
  if (severity >= 7) {
    // 고중증도: 시간 60%, 병상 40%
    finalScore = timeScore * 0.6 + bedScore * 0.4;
  } else if (severity >= 4) {
    // 중등도: 시간 50%, 병상 50%
    finalScore = timeScore * 0.5 + bedScore * 0.5;
  } else {
    // 경증: 시간 40%, 병상 60%
    finalScore = timeScore * 0.4 + bedScore * 0.6;
  }
  
  return Math.round(finalScore * 100);
}

// 두 지점 간 거리 계산 (Haversine formula)
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // 지구 반지름 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 병원 추천 API
app.post('/api/recommend', async (c) => {
  const body = await c.req.json();
  const { latitude, longitude, severity } = body;

  if (!latitude || !longitude || !severity) {
    return c.json({ success: false, error: '위치와 중증도 정보가 필요합니다.' }, 400);
  }

  // 응급실 데이터 가져오기
  const response = await fetch(`${c.req.url.split('/api')[0]}/api/emergency-rooms`);
  const { data: rooms } = await response.json();

  // 각 병원까지의 거리와 예상 시간 계산
  const roomsWithDistance = rooms.map((room: EmergencyRoom) => {
    const distance = calculateDistance(
      latitude,
      longitude,
      room.latitude,
      room.longitude
    );
    
    // 평균 속도 30km/h로 예상 시간 계산 (분)
    const travelTime = Math.round((distance / 30) * 60);
    
    // 추천 점수 계산
    const score = calculateRecommendationScore(
      severity,
      room.availableBeds,
      room.totalBeds,
      travelTime
    );

    return {
      ...room,
      distance: Math.round(distance * 10) / 10,
      travelTime,
      score
    };
  });

  // 점수 순으로 정렬
  roomsWithDistance.sort((a, b) => (b.score || 0) - (a.score || 0));

  return c.json({
    success: true,
    data: roomsWithDistance,
    userLocation: { latitude, longitude },
    severity,
    timestamp: new Date().toISOString()
  });
});

// 메인 페이지 HTML
const mainHTML = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>응급실 실시간 추천 시스템</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gradient-to-br from-red-50 to-blue-50 min-h-screen">
    <div class="container mx-auto px-4 py-8">
        <div class="max-w-4xl mx-auto">
            <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
                <h1 class="text-3xl font-bold text-red-600 mb-2">
                    <i class="fas fa-hospital-alt mr-2"></i>
                    응급실 실시간 추천 시스템
                </h1>
                <p class="text-gray-600">현재 위치와 중증도를 입력하면 최적의 응급실을 추천한다</p>
            </div>

            <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
                <h2 class="text-xl font-bold mb-4 text-gray-800">
                    <i class="fas fa-edit mr-2"></i>
                    정보 입력
                </h2>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            현재 위치 (주소)
                        </label>
                        <input type="text" id="address" 
                               class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                               placeholder="예: 서울특별시 종로구 세종대로 209">
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">위도</label>
                            <input type="number" id="latitude" step="0.000001"
                                   class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                   placeholder="37.5665">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">경도</label>
                            <input type="number" id="longitude" step="0.000001"
                                   class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                   placeholder="126.9780">
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            중증도 (1-10)
                        </label>
                        <div class="flex items-center space-x-4">
                            <input type="range" id="severity" min="1" max="10" value="5"
                                   class="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                            <span id="severityValue" class="text-2xl font-bold text-red-600 w-12 text-center">5</span>
                        </div>
                        <div class="flex justify-between text-xs text-gray-500 mt-1">
                            <span>경증 (1)</span>
                            <span>중등도 (5)</span>
                            <span>중증 (10)</span>
                        </div>
                    </div>

                    <button id="getCurrentLocation" 
                            class="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition">
                        <i class="fas fa-location-arrow mr-2"></i>
                        현재 위치 가져오기
                    </button>

                    <button id="searchBtn" 
                            class="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 transition font-bold text-lg">
                        <i class="fas fa-search mr-2"></i>
                        최적 응급실 찾기
                    </button>
                </div>
            </div>

            <div id="loading" class="hidden bg-white rounded-lg shadow-lg p-6 mb-6">
                <div class="text-center">
                    <i class="fas fa-spinner fa-spin text-4xl text-red-600 mb-4"></i>
                    <p class="text-gray-600">응급실 정보를 분석 중입니다...</p>
                </div>
            </div>

            <div id="results" class="hidden"></div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    <script>
        const severitySlider = document.getElementById('severity');
        const severityValue = document.getElementById('severityValue');
        
        severitySlider.addEventListener('input', (e) => {
            severityValue.textContent = e.target.value;
            
            const value = parseInt(e.target.value);
            if (value <= 3) {
                severityValue.className = 'text-2xl font-bold text-green-600 w-12 text-center';
            } else if (value <= 7) {
                severityValue.className = 'text-2xl font-bold text-yellow-600 w-12 text-center';
            } else {
                severityValue.className = 'text-2xl font-bold text-red-600 w-12 text-center';
            }
        });

        document.getElementById('getCurrentLocation').addEventListener('click', () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        document.getElementById('latitude').value = position.coords.latitude;
                        document.getElementById('longitude').value = position.coords.longitude;
                        alert('현재 위치를 가져왔습니다');
                    },
                    (error) => {
                        alert('위치 정보를 가져올 수 없습니다: ' + error.message);
                    }
                );
            } else {
                alert('이 브라우저는 위치 정보를 지원하지 않습니다');
            }
        });

        document.getElementById('searchBtn').addEventListener('click', async () => {
            const latitude = parseFloat(document.getElementById('latitude').value);
            const longitude = parseFloat(document.getElementById('longitude').value);
            const severity = parseInt(document.getElementById('severity').value);

            if (!latitude || !longitude) {
                alert('위도와 경도를 입력해주세요');
                return;
            }

            document.getElementById('loading').classList.remove('hidden');
            document.getElementById('results').classList.add('hidden');

            try {
                const response = await axios.post('/api/recommend', {
                    latitude,
                    longitude,
                    severity
                });

                displayResults(response.data);
            } catch (error) {
                alert('오류가 발생했습니다: ' + error.message);
            } finally {
                document.getElementById('loading').classList.add('hidden');
            }
        });

        function displayResults(data) {
            const resultsDiv = document.getElementById('results');
            const rooms = data.data;

            let html = '<div class="bg-white rounded-lg shadow-lg p-6">';
            html += '<h2 class="text-xl font-bold mb-4 text-gray-800">';
            html += '<i class="fas fa-list-ol mr-2"></i>';
            html += '추천 응급실 (총 ' + rooms.length + '개)';
            html += '</h2>';
            html += '<p class="text-sm text-gray-600 mb-4">';
            html += '중증도 <strong class="text-red-600">' + data.severity + '</strong> 기준으로 정렬되었습니다';
            html += '</p>';

            rooms.forEach((room, index) => {
                const rank = index + 1;
                const medalClass = rank === 1 ? 'text-yellow-500' : rank === 2 ? 'text-gray-400' : rank === 3 ? 'text-orange-500' : 'text-gray-300';
                const borderClass = rank === 1 ? 'border-l-4 border-red-600' : '';

                html += '<div class="mb-4 p-4 border rounded-lg hover:shadow-md transition ' + borderClass + '">';
                html += '<div class="flex items-start justify-between mb-2">';
                html += '<div class="flex items-center space-x-2">';
                html += '<i class="fas fa-medal ' + medalClass + ' text-2xl"></i>';
                html += '<h3 class="text-lg font-bold text-gray-800">' + room.name + '</h3>';
                html += '</div>';
                html += '<div class="text-right">';
                html += '<div class="text-2xl font-bold text-red-600">' + room.score + '점</div>';
                html += '<div class="text-xs text-gray-500">추천 점수</div>';
                html += '</div>';
                html += '</div>';
                
                html += '<div class="space-y-2 text-sm">';
                html += '<div class="flex items-center text-gray-600">';
                html += '<i class="fas fa-map-marker-alt w-5"></i>';
                html += '<span>' + room.address + '</span>';
                html += '</div>';
                html += '<div class="flex items-center text-gray-600">';
                html += '<i class="fas fa-phone w-5"></i>';
                html += '<span>' + room.phone + '</span>';
                html += '</div>';
                
                html += '<div class="grid grid-cols-3 gap-2 mt-3 pt-3 border-t">';
                html += '<div class="text-center">';
                html += '<div class="text-xs text-gray-500">가용 병상</div>';
                html += '<div class="text-lg font-bold text-green-600">' + room.availableBeds + '/' + room.totalBeds + '</div>';
                html += '</div>';
                html += '<div class="text-center">';
                html += '<div class="text-xs text-gray-500">거리</div>';
                html += '<div class="text-lg font-bold text-blue-600">' + room.distance + 'km</div>';
                html += '</div>';
                html += '<div class="text-center">';
                html += '<div class="text-xs text-gray-500">예상 시간</div>';
                html += '<div class="text-lg font-bold text-orange-600">' + room.travelTime + '분</div>';
                html += '</div>';
                html += '</div>';
                html += '</div>';
                html += '</div>';
            });

            html += '</div>';
            resultsDiv.innerHTML = html;
            resultsDiv.classList.remove('hidden');
            resultsDiv.scrollIntoView({ behavior: 'smooth' });
        }
    </script>
</body>
</html>`;

// 메인 페이지
app.get('/', (c) => {
  return c.html(mainHTML);
});

export default app
