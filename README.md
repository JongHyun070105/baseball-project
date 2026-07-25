# DIAMOND ROAD

로컬에서 혼자 즐기는 3년제 야구 커리어 게임입니다. 선수를 만들고, 경기를 치르고, 성장시킨 뒤 드래프트 결과까지 진행합니다. 세이브와 설정은 브라우저에 저장되며 계정, 서버, 텔레메트리가 필요하지 않습니다.

A local-first, single-player three-year baseball career game. Create a player, play games, develop through the seasons, and reach the draft. Saves and settings stay in the browser; no account, server, or telemetry is required.

## 설치 / Install

정확한 재현을 위해 Node.js `24.18.0`과 npm `11.8.0`을 사용합니다. `.nvmrc` 또는 `.node-version`을 지원하는 버전 관리자를 사용할 수 있습니다.

Use Node.js `24.18.0` and npm `11.8.0` for reproducible installs. You may use any version manager that understands `.nvmrc` or `.node-version`.

```sh
npm ci
npm run preflight
```

## 개발 / Development

```sh
npm run dev
```

Vite가 출력한 로컬 주소를 브라우저에서 엽니다. 배포용 결과를 확인하려면 다음을 실행합니다.

Open the local URL printed by Vite. To inspect the production bundle locally:

```sh
npm run build
npm run preview
```

## 품질 검사 / Quality controls

```sh
npm run typecheck       # TypeScript
npm run lint            # ESLint, zero warnings
npm test                # unit tests
npm run test:browser    # browser unit/integration tests
npm run test:e2e        # Chromium user journeys
npm run test:visual     # approved UI screenshots
npm run test:performance # local system-Chrome smoke budget
npm run test:assets     # asset provenance/license check
npm run verify          # preflight + static checks + unit tests + assets + build
```

Playwright를 처음 사용할 때는 Chromium을 한 번 설치합니다. E2E 셀렉터 계약과 시각 기준 이미지 갱신 절차는 [docs/testing.md](docs/testing.md)를 참고하세요.

Install Chromium once before the first Playwright run. See [docs/testing.md](docs/testing.md) for the E2E selector contract and visual-baseline workflow.

```sh
npm run setup:browsers
```

## 조작 / Controls

- 마우스 또는 트랙패드: 메뉴 선택과 경기 중 조준
- 타격: 마우스 조준, 좌클릭 일반 스윙, 우클릭 컨택, `Space` 파워, `B` 번트, `T` 타임
- 투구: 숫자키 `1–5` 구종, 마우스 코스, 클릭 유지 후 릴리스
- 수비: `WASD` 이동, `Shift` 전력 질주, `Space` 점프/다이빙, 숫자키 `1–4` 송구
- 주루: `W/S` 진루/귀루, `Shift` 전력 질주, `Enter` 결정, `Space` 슬라이딩 결정, `Esc` 일시정지/계속
- 접근성: 운영체제의 모션 감소 설정과 게임 내 모션/카메라 흔들림 설정 지원

- Mouse or trackpad: menu selection and in-game aiming
- Batting: mouse aim, left-click normal, right-click contact, `Space` power, `B` bunt, `T` time
- Pitching: `1–5` pitch selection, mouse target, click-hold then release
- Fielding: `WASD`, `Shift` sprint, `Space` jump/dive, `1–4` throw; baserunning uses `W/S`, `Shift`, `Enter` to commit, and `Space` to commit with a slide
- Accessibility: reduced-motion preference plus in-game motion and camera-shake settings

## 데이터와 에셋 / Data and assets

세이브는 이 브라우저의 로컬 저장소에만 남습니다. 브라우저 데이터를 지우기 전에 게임 내보내기 기능으로 백업하세요. 다른 브라우저나 기기와 자동 동기화되지 않습니다.

Saves remain only in this browser's local storage. Export a backup before clearing browser data. Saves do not automatically sync across browsers or devices.

현재 게임은 저장소에서 직접 만든 절차적 지오메트리·CSS 그래픽과 런타임 Web Audio 신호만 사용합니다. 외부 에셋을 추가할 때는 파일을 커밋하기 전에 출처, 라이선스, 재배포 조건을 [ASSET_LICENSES.md](ASSET_LICENSES.md)에 기록해야 합니다.

The game uses repository-authored procedural geometry, CSS graphics, and runtime Web Audio signals. Before committing any third-party asset, record its source, license, and redistribution terms in [ASSET_LICENSES.md](ASSET_LICENSES.md).
