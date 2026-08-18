# MESProject

가상공장 운영을 위한 MES(Manufacturing Execution System) 프로젝트입니다.

## 목표

- 생산 계획 및 작업지시 관리
- 공정 진행 현황 추적
- 설비 및 품질 데이터 관리
- 생산 실적과 핵심 지표 시각화

프로젝트 구조와 실행 방법은 구현이 진행되는 대로 문서화합니다.

## 가상공장 Edge 실행

Node-RED와 Mosquitto를 Docker로 실행하고 KAMP 사출성형 CSV를 MQTT 이벤트로 재생할 수 있습니다.
설정과 Topic, 시험 명령은 [`edge/README.md`](edge/README.md)를 참고합니다.

```powershell
docker compose up -d
```

## 데이터셋

KAMP 사출성형기 데이터셋을 로컬 개발 데이터로 사용합니다. 파일 구성과 품질 주의사항은
[`data/external/kamp/injection-molding/README.md`](data/external/kamp/injection-molding/README.md)를 참고합니다.
