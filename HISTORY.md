# SudoQuaternion 개발 히스토리

## 프로젝트 개요
3차원 회전을 Quaternion으로 서술하는 이유를 독창적인 시각화로 실험하는 프로젝트

---

## v1.0 - 초기 구현 (Initial Implementation)
**커밋**: `8c3187d`

### 구현 내용
- Pseudo-quaternion 회전 시각화 기본 구현
- Q = cos(θ)·ẑ + sin(θ)·D 형태의 유사 쿼터니언 정의
- z축을 항등원으로 사용하는 기하학적 해석
- QV 및 QVQ⁻¹ 연산 애니메이션
- Three.js 기반 3D 뷰포트 (마우스로 회전/확대/이동)

---

## v2.0 - Real Quaternion 모드 및 시각화 개선

### 1. Real Quaternion 모드 추가
- **Real Quaternion Mode** 체크박스 추가
- 진짜 쿼터니언 연산 구현: Q = cos(θ/2) + sin(θ/2)·(xi + yj + zk)
- 축 매핑:
  - viewport z축 → quaternion real 성분 (w)
  - viewport x축 → quaternion i 성분
  - viewport y축 → quaternion j 성분
  - k 성분은 시각화에서 제외

### 2. Quat 클래스 구현
```javascript
class Quat {
    constructor(w, x, y, z)
    multiply(other)      // 쿼터니언 곱셈
    conjugate()          // 켤레 쿼터니언
    normalize()          // 정규화
    toVisualPosition()   // 3D 시각화 좌표로 변환
}
```

### 3. 시각화 개선
- Q, V, Q⁻¹ 위치에 projection point 추가 (xy 평면 투영)
- 각도 정보 패널 추가 (Q ↔ _Q, Q ↔ Final, _Q ↔ Final)
- Show Final Result (QVQ⁻¹) 체크박스로 최종 결과 토글

### 4. 버그 수정
- BufferAttribute 업데이트 방식 수정 (`needsUpdate = true`)
- finalResultProjection 객체 추적 문제 해결

---

## v2.1 - 항등원 변환 시각화

### 항등원(1) 변환 애니메이션 추가
- **Pseudo 모드**: z축 (0, 0, 1)이 항등원 역할
- **Real 모드**: (1, 0, 0, 0) → visual (0, 0, 1)

### QV 연산 시
- 항등원 1이 V로 변환되는 과정 시각화
- 회색 구체로 표시

### QVQ⁻¹ 연산 시
- 1단계: 1 → V (QV 연산)
- 2단계: 1 → Q⁻¹ (×Q⁻¹ 연산)

---

## v2.2 - 스케일 변화 색상 애니메이션

### 색상으로 스케일 변화 표현
곱셈 연산 시 스케일(크기)이 변하면 색상도 변하고, 방향만 변하면 색상 유지

### QV 연산 (스케일 변화 O → 색상 변화 O)
| 요소 | 시작 색상 | 종료 색상 |
|------|-----------|-----------|
| Q | 청록 (cyan) | 주황 (orange) |
| 항등원 | 회색/녹색 | 노랑 (yellow) |

### ×Q⁻¹ 연산 (스케일 변화 X → 색상 유지)
- Q⁻¹는 단위 쿼터니언이므로 방향만 변경
- _Q → Final: 주황색 유지
- V → Q⁻¹: 노란색 유지

### 적용된 애니메이션 함수
1. `animateRealQV()` - Real 모드 QV
2. `animateRealQVQ()` - Real 모드 QVQ⁻¹
3. `animatePseudoQV()` - Pseudo 모드 QV
4. `animatePseudoQVQ()` - Pseudo 모드 QVQ⁻¹

---

## 파일 구조

```
SudoQuaternion/
├── index.html          # UI 및 컨트롤 패널
├── main.js             # 핵심 로직 및 Three.js 시각화
├── ProjectPlan.md      # 프로젝트 계획 문서
├── start_server.bat    # Python 웹서버 실행 스크립트
└── HISTORY.md          # 개발 히스토리 (현재 문서)
```

---

## 사용 방법

1. `start_server.bat` 실행
2. 브라우저에서 `http://localhost:8000` 접속
3. 컨트롤 패널에서:
   - θ: 회전 각도 조절
   - Dx, Dy: 회전축 방향 조절
   - Vx, Vy: 회전 대상 점 위치 조절
   - Real Quaternion Mode: 진짜 쿼터니언 모드 전환
   - Show Final Result: 최종 결과 표시
4. Animate QV / Animate QVQ⁻¹ 버튼으로 애니메이션 실행

---

## 핵심 개념

### 곱셈의 기하학적 의미
a × b 연산:
1. 항등원(1)과 a가 있는 좌표계 존재
2. 항등원을 b 위치로 좌표계 변환
3. 변환된 좌표계에서 a의 새로운 위치 확인

### 왜 QVQ⁻¹인가?
- QV만으로는 회전이 아닌 다른 변환 발생
- Q⁻¹를 곱해야 순수 회전 결과 획득
- 색상 애니메이션으로 시각적 확인 가능:
  - QV: 스케일 변화 (색상 변함)
  - ×Q⁻¹: 방향만 변화 (색상 유지)
