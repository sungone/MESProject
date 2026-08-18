# 가상공장 Edge 환경

이 디렉터리는 KAMP 사출성형 CSV를 가상 PLC 데이터로 변환하여 MQTT로 발행하는 개발용 Edge 계층입니다.

## 구성

- Node-RED: CSV 재생, Shot 그룹화, 가상 PLC 이벤트 생성, MES 명령 ACK
- Eclipse Mosquitto: MQTT Broker
- 기본 데이터: `cycle-records/moldset_labeled.csv`
  - 설비: `S14 / 650톤-우진2호기`
  - 품목: CN7 및 RG3 앞유리 사이드 몰딩 LH/RH
  - 같은 설비·타임스탬프·생산 시리얼의 LH/RH 행을 한 Shot으로 처리

## 실행

Docker Desktop을 실행한 후 프로젝트 루트에서 다음 명령을 실행한다.

```powershell
docker compose up -d
docker compose ps
```

- Node-RED 편집기: http://localhost:1880
- MQTT Broker: `localhost:1883`

Node-RED 편집기에서 `▶ CSV 재생 시작` Inject 버튼을 누르면 1초에 한 Shot씩 발행한다.
`■ 대기열 정지/비우기`를 누르면 아직 발행되지 않은 Shot 대기열을 제거한다.

## MQTT Topic

```text
factory/injection/{equipmentId}/state
factory/injection/{equipmentId}/telemetry/cycle
factory/injection/{equipmentId}/cycle/completed
factory/injection/{equipmentId}/quality
factory/injection/{equipmentId}/command
factory/injection/{equipmentId}/command/ack
factory/edge/node-red/availability
```

CSV의 한 행을 초단위 원시 센서값으로 위장하지 않고 `CYCLE_TELEMETRY_SNAPSHOT`으로 발행한다.
현재 시각은 `eventTime`, KAMP 원본 시각은 `sourceEventTime`에 저장한다.

## 전체 이벤트 확인

호스트에 Mosquitto Client가 설치되어 있으면 다음 명령을 사용할 수 있다.

```powershell
mosquitto_sub -h localhost -p 1883 -t "factory/#" -v
```

Docker만 사용하는 경우:

```powershell
docker compose exec mosquitto mosquitto_sub -h localhost -p 1883 -t "factory/#" -v
```

## MES Command 시험

```powershell
docker compose exec mosquitto mosquitto_pub `
  -h localhost -p 1883 `
  -t "factory/injection/S14/command" `
  -q 1 `
  -m '{"commandId":"CMD-DEMO-001","commandType":"LOAD_WORK_ORDER","equipmentId":"S14","payload":{"workOrderId":"WO-CN7-001","plannedShots":100}}'
```

지원 명령은 `LOAD_WORK_ORDER`, `LOAD_RECIPE`, `START`, `STOP`, `HOLD`, `RELEASE`, `RESET`이다.
가상 PLC는 결과를 `factory/injection/S14/command/ack`로 발행한다.

## 다른 설비 데이터 사용

`flows.json`의 File 노드 경로를 아래 파일로 변경하면 S01~S15의 여러 사출기 기록을 재생할 수 있다.

```text
/opt/kamp/cycle-records/unlabeled_data.csv
```

단, 이 파일은 개별 제품 품질 라벨이 없으므로 `qualityResult`는 `UNKNOWN`으로 발행된다.

## 개발환경 주의

현재 Mosquitto는 요청된 로컬 준비 단계에 맞춰 `allow_anonymous true`로 구성되어 있다.
외부 서버나 운영환경에 노출하기 전에 익명 접속을 끄고 사용자 인증, Topic ACL, TLS를 적용해야 한다.

## 종료

```powershell
docker compose down
```

Mosquitto 영속 데이터를 함께 삭제하려면 해당 데이터의 필요 여부를 확인한 후 별도로 정리한다.
