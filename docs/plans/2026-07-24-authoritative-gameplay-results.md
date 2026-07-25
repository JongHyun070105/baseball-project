# Authoritative gameplay results completion plan

## Goal
UI/scene controllers가 계산한 `outcome`을 신뢰하지 않고, 저장 가능한 raw player intent만 domain reducer가 결정론적으로 판정한다. 기존 점수/아웃을 수비 연출에서 중복 적용하지 않으며 기존 세이브와 replay를 안전하게 마이그레이션한다.

## Steps
1. Regression tests
   - forged UI outcome 무시
   - 수비 scene이 기존 점수/아웃을 다시 적용하지 않음
   - 주루 결정은 베이스/득점/아웃을 한 번만 반영
   - legacy replay outcome 유효성 검사 및 raw-intent replay 재생
2. Contracts and migration
   - replay schema 3, save schema 4
   - v0/v1/v2/v3 save import 유지
   - replay schema 1/2를 schema 3으로 정규화
   - ADR 0003 추가
3. Domain/UI
   - raw fielding/baserunning intent만 command에 기록
   - domain RNG로 terminal 결과 생성
   - UI는 authoritative terminal만 표시
4. Verification
   - focused unit tests
   - `npm run verify`
   - browser/E2E/visual/performance
   - 실제 브라우저 플레이 QA
   - `graphify update .`
5. Delivery
   - secret/diff 검토
   - commit/push
   - local preview + ngrok
   - public URL HTTP/브라우저 검증
