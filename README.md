# 🦕 Haeryong Dinosaur Era

1주년 기념 · 별명 도감 형식의 빈티지 박물관 컨셉 페이지.

## 컨셉

빈티지 자연사 박물관의 표본 카드(specimen plate) 형식으로,
여자친구의 사진마다 별명을 붙여 도감으로 만든 페이지.
별명 맞추기 퀴즈로 둘이서 함께 보는 용도.

## 기능

- 🦕 **갤러리 (`/`)** — 빈티지 표본 카드 슬라이더
  - 시작 시 인트로 화면 (D-day, 설명)
  - 사진 표본 순서 그대로 (셔플 없음)
  - **2단계 별명 공개**: 탭하면 별명 → 한 번 더 탭하면 설명
  - 자동 넘김 토글 (기본 OFF / 5초 / 10초)
  - BGM 토글 (옵션)
  - "처음부터" 버튼으로 1번부터 다시
- 🔒 **큐레이터 (`/curator-xxxxxxxx`)** — 관리자 페이지
  - 비밀번호 인증
  - 표본 등록 (사진 + 별명 + 설명 + 날짜)
  - 편집 / 삭제
  - 화살표(↑↓)로 순서 변경
  - 사진 최적화 자동 (1600px JPEG)

## 데이터 모델

```
post {
  id, order,            // order 순으로 갤러리 표시
  nickname,             // 별명 (퀴즈 정답)
  description,          // 설명 (사연)
  captured_at,          // 날짜 (자유 형식)
  image_file, image_mime,
  created_at,
}
```

## 로컬 실행

```bash
npm install
ADMIN_PASSWORD=mypassword npm start
```

→ http://localhost:3000

## Railway 배포

### 1. GitHub push & Railway 연결
새 브랜치 → Railway에서 **Deploy from GitHub repo** → 해당 브랜치 선택

### 2. 환경 변수 설정 (필수!)
**Variables** 탭에서:

| 변수 | 값 | 설명 |
|---|---|---|
| `ADMIN_PASSWORD` | (강력한 비밀번호) | 큐레이터 인증 비번 |
| `ADMIN_PATH` | (랜덤 문자열) | 관리자 페이지 URL의 시크릿 부분 |

`ADMIN_PATH` 안 정하면 기본값 `curator-7f3a9c2e` 사용.

### 3. 볼륨 마운트 (필수!)
**Volumes** 탭 → **+ New Volume**
- Mount path: `/data`
- 크기: 1GB

이거 없으면 재배포 시 사진과 데이터가 모두 사라집니다.

### 4. 도메인 발급
**Settings → Networking → Generate Domain**

- 갤러리: `https://<도메인>/`
- 관리자: `https://<도메인>/curator-7f3a9c2e` (또는 본인 ADMIN_PATH)

## 시작 날짜 변경

`public/js/main.js` 맨 위에서 D-day 시작일 변경 가능:

```javascript
const ANNIVERSARY_START = new Date('2025-05-24T00:00:00');
```

## API

| Method | Endpoint | 설명 |
|---|---|---|
| GET    | `/api/posts` | 갤러리용 목록 (order 순) |
| GET    | `/api/posts/:id/image` | 이미지 바이너리 |
| POST   | `/api/admin/login` | 로그인 → 전체 posts 반환 |
| POST   | `/api/admin/posts` | 표본 등록 (multipart) |
| PUT    | `/api/admin/posts/:id` | 표본 편집 (multipart) |
| POST   | `/api/admin/reorder` | 순서 일괄 업데이트 |
| DELETE | `/api/admin/posts/:id` | 표본 삭제 |

모든 admin API는 body에 `password` 필요.

## BGM 추가

`public/bgm.mp3` 로 저장하면 갤러리 메뉴에서 켜고 끌 수 있어요.
