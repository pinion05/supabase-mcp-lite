# Smithery MCP 개발 가이드

## Smithery MCP란?

Smithery는 Model Context Protocol (MCP) 서버를 빌드, 배포, 호스팅할 수 있는 플랫폼입니다. MCP 서버는 AI 모델(Claude, Cursor IDE 등)과 외부 도구/API 간의 표준화된 브릿지 역할을 합니다.

## 핵심 개념

### MCP (Model Context Protocol)
- AI 모델이 외부 도구나 데이터를 요청하는 표준화된 프로토콜
- 일반적인 "function calling"보다 더 일관되고 안전한 방식 제공
- 세 가지 주요 기능:
  - **Resources**: 파일과 유사한 읽기 가능한 데이터
  - **Tools**: LLM이 호출할 수 있는 함수 (사용자 승인 필요)
  - **Prompts**: 특정 작업을 위한 템플릿

### Smithery 플랫폼 장점
- **Discovery**: 사용자가 온라인에서 MCP 서버를 발견하고 시도할 수 있는 인터랙티브 플레이그라운드
- **Zero Setup**: 의존성 설치나 보안 걱정 없이 모든 MCP 클라이언트에서 연결 가능
- **Better Visibility**: 호스팅된 서버는 검색 결과와 레지스트리에서 높은 순위

## Smithery MCP 개발 방법

### 1. TypeScript 기반 개발 (권장)

#### 빠른 시작
```bash
# Smithery CLI로 TypeScript MCP 서버 스캐폴드 생성
npm create smithery
```

#### 프로젝트 구조
```typescript
// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// 선택적: 세션 구성 스키마
export const configSchema = z.object({
  debug: z.boolean().default(false).describe("Enable debug logging"),
});

export default function createServer({ config }) {
  const server = new McpServer({
    name: "Your MCP Server",
    version: "1.0.0",
  });

  // 도구 등록
  server.registerTool("tool_name", {
    title: "Tool Title",
    handler: async (params) => {
      // 도구 구현
      return { result: "success" };
    }
  });

  return server;
}
```

#### smithery.yaml 설정
```yaml
runtime: "typescript"  # TypeScript 런타임 사용
env:
  NODE_ENV: "production"
  # 환경 변수 추가
```

### 2. Container 기반 개발 (고급)

Python, Go 등 다른 언어나 복잡한 의존성이 필요한 경우 Docker 컨테이너 사용:

#### smithery.yaml 설정
```yaml
runtime: "container"
```

#### Dockerfile 예시
```dockerfile
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

## 배포 프로세스

### 1. GitHub 레포지토리 연결
1. Smithery 대시보드에서 GitHub 레포지토리 연결
2. 자동 CI/CD 파이프라인 설정

### 2. 로컬 테스트
```bash
# Smithery CLI로 로컬 테스트
npx @smithery/cli inspect .

# 특정 서버 테스트
npx @smithery/cli inspect @username/server-name
```

### 3. 배포
- main 브랜치에 푸시하면 자동 배포
- Smithery 대시보드에서 수동 배포도 가능

## HTTP Streaming 지원

Smithery는 HTTP 스트리밍을 기본 지원하여:
- 실시간 응답 스트리밍
- 긴 실행 작업 처리
- 향상된 사용자 경험

## 클라이언트 연결

### Claude Desktop
```json
{
  "servers": {
    "your-server": {
      "command": "npx",
      "args": ["@smithery/cli", "connect", "@username/server-name"]
    }
  }
}
```

### Cursor IDE
Smithery에서 제공하는 원클릭 연결 기능 사용

## 주요 특징

### 1. Session Configuration
- 사용자별 구성 가능
- API 키, 환경 설정 등을 세션별로 관리

### 2. OAuth 지원
- 외부 서비스 인증을 위한 OAuth 플로우 내장

### 3. 모니터링 및 분석
- 사용량 추적
- 오류 모니터링
- 성능 메트릭

## 모범 사례

1. **명확한 도구 이름**: 도구 이름은 기능을 명확히 설명
2. **에러 처리**: 모든 도구에 적절한 에러 처리 구현
3. **문서화**: 각 도구, 리소스, 프롬프트에 대한 상세 설명 포함
4. **테스트**: 배포 전 로컬에서 충분한 테스트
5. **버전 관리**: 의미있는 버전 번호 사용

## 유용한 리소스

- [Smithery 공식 문서](https://smithery.ai/docs)
- [MCP 프로토콜 사양](https://modelcontextprotocol.io)
- [Smithery CLI GitHub](https://github.com/smithery-ai/cli)
- [예제 레포지토리](https://github.com/smithery-ai/smithery-cookbook)

## 현재 프로젝트에 적용

현재 `supabase-mcp-lite` 프로젝트는 이미 Smithery를 위한 기본 설정이 되어 있습니다:
- `smithery.yaml` 파일로 TypeScript 런타임 설정
- `src/index.ts`에 MCP 서버 구현
- GitHub 레포지토리 생성 완료

다음 단계:
1. Smithery 대시보드에서 GitHub 레포지토리 연결
2. 환경 변수 설정 (Supabase URL, API 키 등)
3. 배포 및 테스트