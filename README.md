# 🌿 Teacher's Day · 우리 교수님께

랩실 학생들이 사진과 편지를 모아 교수님께 드리는 스승의 날 헌정 페이지.

## 기능

- 🖼️ **갤러리 (`/`)** — 모바일 최적화 풀스크린 뷰어
  - 시작 시 랜덤 순서로 사진 노출
  - 5초마다 자동 페이드 전환
  - 좌우 버튼 / 스와이프 / 키보드(←→) 수동 슬라이드
  - 사진 탭 → 바텀시트로 편지 노출
  - 편집 버튼 → 비밀번호 확인 → 편집/삭제 (삭제 시 컨펌)
- ✉️ **업로드 (`/upload`)** — 사진 + 이름 + 편지 + 비밀번호
- 🔒 비밀번호는 bcrypt 해시 저장. 평문은 서버에 남지 않음.
- 💾 SQLite + 파일시스템. Railway 볼륨에 영속화.

## 로컬 실행

```bash
npm install
npm start
```

→ http://localhost:3000

## Railway 배포

### 1. GitHub 푸시
이 폴더를 새 GitHub 저장소에 푸시하세요.

### 2. Railway 프로젝트 생성
1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. 이 저장소 선택
3. 자동으로 Nixpacks가 Node.js 빌드 → `npm install` → `node server.js`

### 3. 영속 볼륨 마운트 (중요!)
Railway 컨테이너는 재배포할 때 디스크가 초기화되므로 반드시 볼륨을 붙여야 합니다.

1. 서비스 → **Variables** 탭 → **New Variable** → 자동으로 `PORT`가 주입됨 (그대로 둠)
2. 서비스 → **Settings** → **Volumes** → **+ New Volume**
   - **Mount path**: `/data`
   - 크기는 기본값(1GB)이면 충분
3. **Deploy** → 환경 변수 `DATA_DIR`이 별도로 없으면 서버가 자동으로 `/data`를 사용합니다.

### 4. 도메인 발급
서비스 → **Settings** → **Networking** → **Generate Domain** → 학생들에게 공유:
- 갤러리: `https://<your-app>.up.railway.app/`
- 업로드: `https://<your-app>.up.railway.app/upload`

## 환경 변수 (선택)

| 변수        | 기본값                              | 설명                            |
| ----------- | ----------------------------------- | ------------------------------- |
| `PORT`      | `3000`                              | Railway가 자동 주입             |
| `DATA_DIR`  | `/data` (있으면) or `./data`        | SQLite + 업로드 이미지 저장 경로 |

## 폴더 구조

```
.
├── server.js              # Express API + 정적 서빙
├── package.json
├── railway.json
├── public/
│   ├── index.html         # 갤러리
│   ├── upload.html        # 업로드
│   ├── css/
│   │   ├── main.css
│   │   └── upload.css
│   └── js/
│       ├── main.js
│       └── upload.js
└── data/                  # (자동 생성) SQLite + 업로드 이미지
    ├── app.db
    └── uploads/
```

## API 요약

| Method | Endpoint                  | 설명                                     |
| ------ | ------------------------- | ---------------------------------------- |
| GET    | `/api/posts`              | 게시물 목록 (비밀번호 정보 제외)         |
| GET    | `/api/posts/:id/image`    | 이미지 파일                              |
| POST   | `/api/posts`              | 새 게시물 (multipart: author/message/password/image) |
| POST   | `/api/posts/:id/verify`   | 비밀번호 검증 `{ password }` → `{ ok }`  |
| PUT    | `/api/posts/:id`          | 수정 (multipart, password 필요)          |
| DELETE | `/api/posts/:id`          | 삭제 `{ password }`                      |

## 디자인 노트

- 컬러: 따뜻한 크림 페이퍼 (#F4EFE7) + 브론즈 액센트 (#8B5E3C)
- 타이포: Pretendard (본문, 한글) + Fraunces (세리프 헤딩, 영문)
- 이미지: `object-fit: contain`으로 사진을 자르지 않고 풀-비저블, 빈 여백은 베이스 컬러로 채움
- 편지 시트는 iOS 스타일 바텀시트 (드래그 다운으로 닫기 가능)

즐거운 스승의 날 되세요 🌿
