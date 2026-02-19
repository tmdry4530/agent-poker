# Multi-AI Orchestration (OMC + Gemini/Codex)

## 목적
- Claude Code/OMC가 메인 실행(코드 작성/수정/테스트)
- 필요 시 외부 AI를 “교차 검증/리뷰”로 사용 (ask_codex / ask_gemini)

## OMC에서 제공되는 External AI 도구
- `ask_codex`: 아키텍처 검증/코드리뷰/플래닝 검증
- `ask_gemini`: UI/UX 일관성/문서/비주얼 분석
(OMC 문서에 역할/권장 사용처가 정리되어 있음)

## 설치(선택)
OMC README 기준(선택 기능):
- Gemini CLI 설치: `npm install -g @google/gemini-cli`
- Codex CLI 설치: `npm install -g @openai/codex`

## 설정
- OMC 설치 후 `/omc:omc-setup`
- MCP 설정은 `/oh-my-claudecode:mcp-setup` (또는 omc-setup에서 함께)

## 병렬 컨설팅 패턴(권장)
- 외부 AI 컨설팅은 백그라운드로 띄우고,
  필요한 시점에 결과를 await 하여 의사결정에 반영한다.

## 운영 원칙
- 외부 AI가 불가/실패하면, OMC는 Claude 에이전트로 graceful fallback 해야 한다.
- 외부 AI output은 반드시 docs/WORKLOG.md에 “요약+결론+적용 여부” 기록.
