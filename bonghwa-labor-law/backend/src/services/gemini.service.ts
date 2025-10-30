import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs/promises';
import * as path from 'path';
import ElisCrawlerService from './elis-crawler.service';
import LawCrawlerService from './law-crawler.service';

class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private regulationContextCache: string | null = null;
  private lawContextCache: string | null = null;

  private initialize() {
    if (this.genAI && this.model) {
      return; // Already initialized
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      throw new Error('유효한 GEMINI_API_KEY를 .env 파일에 설정해주세요. https://makersuite.google.com/app/apikey 에서 발급받을 수 있습니다.');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-pro',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        topP: 0.7,
      },
    });
  }

  /**
   * 반복되는 문장 제거 (환각 방지)
   */
  private removeRepetitiveContent(text: string): string {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const seenSentences = new Set<string>();
    const uniqueSentences: string[] = [];
    let repetitionCount = 0;

    for (const sentence of sentences) {
      const cleanSentence = sentence.trim();
      if (cleanSentence) {
        if (seenSentences.has(cleanSentence)) {
          repetitionCount++;
          // 반복 발견 시 즉시 중단
          console.log(`⚠️ 반복 감지: "${cleanSentence.substring(0, 30)}..."`);
          break;
        }
        seenSentences.add(cleanSentence);
        uniqueSentences.push(sentence);
      }
    }

    const cleanedText = uniqueSentences.join(' ').trim();

    // 최대 2000자로 제한 (추가 안전장치)
    const truncated = cleanedText.length > 2000 ? cleanedText.substring(0, 2000) : cleanedText;

    if (repetitionCount > 0) {
      console.log(`✂️ Removed ${repetitionCount} repetitive sentences`);
    }

    return truncated;
  }

  /**
   * 마크다운 형식 후처리 - Claude/Groq 서비스와 동일한 처리
   */
  private formatMarkdown(text: string): string {
    let formatted = text;

    // "문장. ##" 패턴을 "문장.\n\n##"로 변경
    formatted = formatted.replace(/([.!?])\s+##\s+/g, '$1\n\n## ');

    // "문장\n##" 패턴을 "문장\n\n##"로 변경
    formatted = formatted.replace(/([^\n])\n##\s+/g, '$1\n\n## ');

    // "문장. ###" 패턴을 "문장.\n\n###"로 변경
    formatted = formatted.replace(/([.!?])\s+###\s+/g, '$1\n\n### ');

    // "문장\n###" 패턴을 "문장\n\n###"로 변경
    formatted = formatted.replace(/([^\n])\n###\s+/g, '$1\n\n### ');

    // 🚨 핵심 수정: 리스트 항목 사이의 빈 줄 제거
    formatted = formatted.replace(/([1-9]\d?\..+)\n\n+(?=[1-9]\d?\. )/g, '$1\n');

    // 각 호 번호(1., 2., 3. 등) 앞에 줄바꿈 추가
    formatted = formatted.replace(/([.!?])\s+([1-9]\d?\.)\s+/g, '$1\n$2 ');

    // 각 항 번호(①, ②, ③ 등) 앞에 줄바꿈 추가
    formatted = formatted.replace(/([.!?])\s+([①②③④⑤⑥⑦⑧⑨⑩])/g, '$1\n\n$2');

    return formatted;
  }

  async chat(messages: { role: 'system' | 'user' | 'assistant'; content: string }[]) {
    try {
      this.initialize(); // Lazy initialization

      // Gemini는 대화 형식이 다르므로 변환
      const prompt = messages.map(msg => {
        if (msg.role === 'system') {
          return `[시스템 지시사항]\n${msg.content}\n`;
        } else if (msg.role === 'user') {
          return `[사용자 질문]\n${msg.content}`;
        }
        return msg.content;
      }).join('\n\n');

      const result = await this.model!.generateContent(prompt);
      const response = await result.response;
      const rawResponse = response.text();

      console.log(`📊 Raw response length: ${rawResponse.length} characters`);

      // 반복 제거 후처리
      const cleanedResponse = this.removeRepetitiveContent(rawResponse);

      // 마크다운 형식 후처리
      const formattedResponse = this.formatMarkdown(cleanedResponse);

      console.log(`📊 Formatted response length: ${formattedResponse.length} characters`);

      return formattedResponse;
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw error;
    }
  }

  private async loadRegulationContext(): Promise<string> {
    if (this.regulationContextCache) {
      return this.regulationContextCache;
    }

    console.log('📚 Loading Bonghwa regulation context...');

    try {
      const regulationData = await ElisCrawlerService.fetchBonghwaRegulation();

      if (!regulationData || !regulationData.articles || regulationData.articles.length === 0) {
        console.warn('⚠️ No regulation data found');
        return '';
      }

      console.log(`📋 Total articles: ${regulationData.articles.length}`);

      const contextParts: string[] = [];

      regulationData.articles.forEach(article => {
        const articleText = `${article.title}\n${article.content}`;
        contextParts.push(articleText);
      });

      const fullContext = contextParts.join('\n\n');
      this.regulationContextCache = fullContext;

      console.log('✅ Regulation context loaded and cached');
      return fullContext;
    } catch (error) {
      console.error('❌ Failed to load regulation context:', error);
      throw error;
    }
  }

  private async loadLawContext(): Promise<string> {
    if (this.lawContextCache) {
      return this.lawContextCache;
    }

    console.log('📚 Loading major labor laws with actual content (Playwright)...');

    // 주요 법령 목록
    const majorLawNames = [
      '근로기준법',
      '남녀고용평등과일·가정양립지원에관한법률',
      '기간제및단시간근로자보호등에관한법률',
    ];

    let context = '## 주요 노동 관련 법령 실제 내용\n\n';
    context += '**중요:** 아래 법령 내용은 실제 법제처에서 크롤링한 것입니다. 반드시 이 내용을 기반으로 답변하세요.\n\n';

    // 실제 법령 내용 크롤링
    for (const lawName of majorLawNames) {
      try {
        const lawInfo = await LawCrawlerService.fetchLawContent(lawName);
        if (lawInfo) {
          context += `### ${lawInfo.name}\n`;
          context += `${lawInfo.summary}\n\n`;
          context += `상세 링크: https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=${lawInfo.lsiSeq}\n\n`;
        }
      } catch (error) {
        console.error(`❌ Failed to fetch ${lawName}:`, error);
      }
    }

    context += '\n**답변 작성 시 유의사항:**\n';
    context += '- 위 법령의 실제 내용을 기반으로 정확히 답변하세요.\n';
    context += '- 추측하거나 지어내지 마세요.\n';
    context += '- 위 내용에 없으면 "제공된 법령 정보에 해당 내용이 없습니다"라고 답변하세요.\n';

    this.lawContextCache = context;
    console.log('✅ Law context loaded and cached');
    return context;
  }

  async searchLaborLaw(query: string, searchType: string = 'all') {
    // 검색 타입에 따라 컨텍스트 로드
    // searchType: 'all' (전체), 'regulation' (봉화군 규정만), 'law' (법령만)
    let regulationContext = '';
    let lawContext = '';

    // 봉화군 규정 컨텍스트 로드 (regulation 또는 all)
    if (searchType === 'all' || searchType === 'regulation') {
      try {
        regulationContext = await this.loadRegulationContext();
      } catch (error) {
        console.warn('⚠️ Failed to load regulation context, continuing without it');
      }
    }

    // 주요 법령 링크 로드 (law 또는 all)
    if (searchType === 'all' || searchType === 'law') {
      try {
        lawContext = await this.loadLawContext();
      } catch (error) {
        console.warn('⚠️ Failed to load law context, continuing without it');
      }
    }

    // 검색 타입에 따라 프롬프트 구성
    let systemPrompt = '';

    if (searchType === 'regulation') {
      // 봉화군 규정만 검색
      systemPrompt = `당신은 봉화군 공무직 근로자를 위한 규정 전문가입니다.
아래 제공된 "봉화군 공무직근로자 등 관리 규정"을 기반으로 사용자의 질문에 정확하고 이해하기 쉽게 답변해주세요.

**답변 형식 (반드시 이 형식을 따르세요):**

## 📋 요약
[한 문장으로 핵심 답변]

## 📖 상세 내용

### 봉화군 공무직근로자 등 관리 규정
[관련 조문을 **완전하게** 인용하고 자세히 설명]

**🎯 조문 선택 규칙 (정확도 최우선):**
1. **질문의 핵심 키워드만 찾으세요**: 예) "병가" → 제38조(병가)만, "연차" → 제15조(연차휴가)만
2. **질문과 직접 관련 없는 조문은 절대 포함하지 마세요**
3. **한 조문만 답변**: 질문에 정확히 일치하는 단 하나의 조문만 찾아서 답변하세요
4. 조문 번호와 제목을 명확히 표시 (예: **제38조(병가)**)
5. 선택한 조문의 **모든 항을 완전하게** 복사 (①②③ 전체)
6. 각 항 안의 **모든 호를 완전하게** 복사 (1.2.3. 전체)
7. 숫자, 날짜, 기간을 **원문 그대로** 정확하게 표시
8. **단 하나의 조문만 답변하세요. 여러 조문을 나열하지 마세요.**

## 💡 참고사항
[추가로 알아두면 좋은 정보]

**🚨🚨🚨 환각 방지 절대 규칙 (위반 시 답변 거부) 🚨🚨🚨:**

**절대 금지 사항:**
❌ 제공된 규정 원문에 없는 조문 번호를 만들어내지 마세요
❌ "일반적으로", "보통", "아마도", "~일 수 있습니다" 등 추측 표현 사용 금지
❌ 근로기준법, 공무원법 등 다른 법령 언급 절대 금지
❌ 제공된 원문에 없는 내용을 상식이나 지식으로 추가하지 마세요
❌ 조문 내용을 요약하거나 해석하지 말고 원문 그대로 복사하세요

**필수 준수 사항:**
✅ **단계 1**: 질문의 키워드를 찾으세요 (예: "병가" → 제38조, "연차" → 제15조)
✅ **단계 2**: 제공된 규정 원문에서 해당 키워드가 포함된 조문을 찾으세요
✅ **단계 3**: 찾은 조문의 전체 내용을 **한 글자도 빠뜨리지 말고** 복사하세요
✅ **단계 4**: 복사한 내용이 원문과 100% 일치하는지 검증하세요
✅ **단계 5**: 원문에 없는 내용이면 "해당 내용은 봉화군 규정에 명시되어 있지 않습니다"라고 답변하세요

**검증 체크리스트:**
□ 언급한 조문 번호가 제공된 원문에 실제로 존재하나요?
□ 조문 내용을 원문에서 그대로 복사했나요? (한 글자도 변경 안 함)
□ 항 번호(①②③)와 호 번호(1.2.3.)가 원문과 정확히 일치하나요?
□ 숫자(일수, 기간)가 원문과 정확히 같나요?
□ 다른 법령이나 규정을 언급하지 않았나요?

**🚨🚨🚨 중요: 마크다운 형식을 정확히 따라야 합니다 🚨🚨🚨**

답변은 반드시 다음 구조를 따르세요. 각 섹션은 2줄의 빈 줄로 구분되어야 합니다.

<example>
## 📋 요약

[한 문장 요약]

## 📖 상세 내용

### 봉화군 공무직근로자 등 관리 규정

**제38조(병가)**

①사용부서의 장은 소속근로자가 다음 각 호의 어느 하나에 해당할 때에는 연 60일의 범위 안에서 병가를 허가할 수 있다.
1. 질병 또는 부상으로 인하여 직무를 수행할 수 없을 때
2. 감염성 질환으로 인하여 그 근로자의 출근이 다른 근로자 등의 건강에 영향을 미칠 우려가 있을 때

②사용부서의 장은 근로자가 업무상 질병 또는 부상으로 직무를 수행할 수 없거나 요양을 필요로 하는 경우에는 인사부서의 협의를 거쳐 연 180일의 범위 안에서 병가를 허가할 수 있다.

## 💡 참고사항

[참고사항]
</example>

**필수 규칙:**
- 모든 ## 제목 앞뒤로 빈 줄 2개
- 모든 ### 제목 앞뒤로 빈 줄 1개
- 각 항(①, ②, ③) 사이에 빈 줄 1개
- 🚨 **각 호(1., 2., 3.)는 연속된 줄로 작성 (빈 줄 없이)**
- 절대로 한 줄에 "내용입니다. ## 다음 제목" 이렇게 붙이지 마세요

**답변 완료 조건:**
- 관련된 모든 조문을 한 번씩만 명확하게 제시했으면 즉시 답변을 종료하세요
- 같은 문장이나 조문이 두 번 이상 나타나면 즉시 중단하세요
- 참고사항 섹션까지 작성했으면 더 이상 추가하지 말고 종료하세요

**🚨 환각 방지 중요 지침 (절대 준수):**
1. **봉화군 규정만 답변하세요. 관련 법령은 언급하지 마세요.**
2. **출처 근거 원칙**: 오직 제공된 "봉화군 공무직근로자 등 관리 규정" 원문에 **실제로 존재하는** 조문만 언급하세요
3. **허구 절대 금지**: 제공된 원문에 없는 조문을 절대 언급하지 마세요
4. **직접 인용 필수**: 조문 전체를 원문 그대로 복사해서 인용하세요
5. **반복 금지**: 같은 내용을 여러 번 반복하지 마세요. 각 조문은 한 번만 명확하게 제시하세요

질문: "${query}"

예시:
질문: "병가는 며칠인가요?"
답변:
## 📋 요약
봉화군 공무직근로자는 연 60일의 병가를 사용할 수 있으며, 60일은 유급입니다.

## 📖 상세 내용
### 봉화군 공무직근로자 등 관리 규정
**제38조(병가)**
① 사용부서의 장은 소속근로자가 다음 각 호의 어느 하나에 해당할 때에는 연 60일의 범위 안에서 병가를 허가할 수 있다.
1. 질병 또는 부상으로 인하여 직무를 수행할 수 없을 때
2. 감염성 질환으로 인하여 그 근로자의 출근이 다른 근로자 등의 건강에 영향을 미칠 우려가 있을 때

⑤ 병가를 사용할 경우 60일은 유급으로 한다.

${regulationContext ? `### 봉화군 공무직근로자 등 관리 규정\n\n${regulationContext}\n\n` : ''}`;

    } else if (searchType === 'law') {
      // 법령만 검색
      systemPrompt = `당신은 노동 관련 법령 전문가입니다.
아래 제공된 관련 법령 링크를 기반으로 사용자의 질문에 정확하고 이해하기 쉽게 답변해주세요.

**답변 형식 (반드시 이 형식을 따르세요):**

## 📋 요약
[한 문장으로 핵심 답변]

## 📖 상세 내용

### 관련 법령
[관련 법령의 조문 번호와 내용을 자세히 설명]

## 💡 참고사항
[추가로 알아두면 좋은 정보]

## 🔗 관련 법령
[관련된 법령과 조문을 링크로 제공]

**답변 완료 조건:**
- 관련 법령 링크를 제공했으면 즉시 답변을 종료하세요
- 같은 문장이나 조문이 두 번 이상 나타나면 즉시 중단하세요
- 관련 법령 섹션까지 작성했으면 더 이상 추가하지 말고 종료하세요

**중요 지침:**
1. **법령만 답변하세요. 봉화군 규정은 언급하지 마세요.**
2. **출처 근거 원칙**: 오직 공식 법령 데이터베이스(법제처)의 실제 원문을 근거로만 답변하세요
3. **허구 금지**: "아마도", "보통은", "일반적으로", "가능성이 있습니다" 등의 추정 표현을 절대 사용하지 마세요
4. **직접 인용 우선**: 법령 조문은 원문 그대로 인용하고, 필요한 경우에만 최소한으로 요약하세요
5. **해석 금지**: 법률 해석이나 개인적 의견을 제시하지 마세요
6. **확인되지 않은 내용**: 법령에 없는 내용은 "해당 내용은 법령에서 확인되지 않았습니다"라고 명시하세요
7. **반복 금지**: 같은 내용을 여러 번 반복하지 마세요. 각 조문은 한 번만 명확하게 제시하세요

**🚨🚨🚨 중요: 마크다운 형식을 정확히 따라야 합니다 🚨🚨🚨**

답변은 반드시 다음 구조를 따르세요. 각 섹션은 2줄의 빈 줄로 구분되어야 합니다.

<example>
## 📋 요약

[한 문장 요약]

## 📖 상세 내용

### 관련 법령

[법령 조문 내용]

## 💡 참고사항

[참고사항]

## 🔗 관련 법령

[법령 링크]
</example>

**필수 규칙:**
- 모든 ## 제목 앞뒤로 빈 줄 2개
- 모든 ### 제목 앞뒤로 빈 줄 1개
- 각 항(①, ②, ③) 사이에 빈 줄 1개
- 🚨 **각 호(1., 2., 3.)는 연속된 줄로 작성 (빈 줄 없이)**
- 절대로 한 줄에 "내용입니다. ## 다음 제목" 이렇게 붙이지 마세요
8. **관련 법령 섹션 작성 규칙:**
   - **⚠️ 절대 금지: 시행령, 시행규칙 조문 링크를 제공하지 마세요**
   - **오직 근로기준법 본문(법률)만 링크하세요**
   - 시행령(lsiSeq=121505)이나 시행규칙(lsiSeq=131228) 링크는 절대 사용하지 마세요
   - 존재하지 않는 조문을 절대 만들지 마세요
   - 확실하지 않은 조문은 링크하지 마세요
   - **출처 표기 형식**: [근로기준법 제X조](https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=265959) - 조문제목
   - 예시: [근로기준법 제60조](https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=265959) - 연차 유급휴가
   - **다시 강조: 근로기준법(lsiSeq=265959)만 사용하세요. 시행령/시행규칙 링크는 절대 금지입니다.**

${lawContext ? `${lawContext}\n\n` : ''}`;

    } else {
      // 전체 검색 (기본)
      systemPrompt = `당신은 봉화군 공무직 근로자를 위한 노동법 전문가입니다.
아래 제공된 "봉화군 공무직근로자 등 관리 규정"과 관련 법령 링크를 기반으로 사용자의 질문에 정확하고 이해하기 쉽게 답변해주세요.

**답변 형식 (반드시 이 형식을 따르세요):**

## 📋 요약
[한 문장으로 핵심 답변]

## 📖 상세 내용

### 봉화군 공무직근로자 등 관리 규정
[관련 조문을 **완전하게** 인용하고 자세히 설명]

**🎯 조문 선택 규칙 (정확도 최우선):**
1. **질문의 핵심 키워드만 찾으세요**: 예) "병가" → 제38조(병가)만, "연차" → 제15조(연차휴가)만
2. **질문과 직접 관련 없는 조문은 절대 포함하지 마세요**
3. **한 조문만 답변**: 질문에 정확히 일치하는 단 하나의 조문만 찾아서 답변하세요
4. 조문 번호와 제목을 명확히 표시 (예: **제38조(병가)**)
5. 선택한 조문의 **모든 항을 완전하게** 복사 (①②③ 전체)
6. 각 항 안의 **모든 호를 완전하게** 복사 (1.2.3. 전체)
7. 숫자, 날짜, 기간을 **원문 그대로** 정확하게 표시
8. **단 하나의 조문만 답변하세요. 여러 조문을 나열하지 마세요.**

### 관련 법령
[해당되는 경우에만 관련 법령 내용 - 조문 번호와 내용을 명시]

## 💡 참고사항
[추가로 알아두면 좋은 정보]

## 🔗 관련 법령
[관련된 법령과 조문을 링크로 제공]

**답변 완료 조건:**
- 관련 법령 링크까지 제공했으면 즉시 답변을 종료하세요
- 같은 문장이나 조문이 두 번 이상 나타나면 즉시 중단하세요
- 관련 법령 섹션까지 작성했으면 더 이상 추가하지 말고 종료하세요

**중요 지침:**
1. 반드시 위의 형식(요약, 상세내용, 참고사항, 관련법령)을 따라 작성하세요
2. **관련된 모든 조문을 빠짐없이 표시하세요. 절대 하나만 선택하지 마세요.**
3. **출처 근거 원칙**: 오직 제공된 "봉화군 공무직근로자 등 관리 규정"과 공식 법령 데이터베이스(법제처)의 실제 원문만 근거로 답변하세요
4. **허구 금지**: "아마도", "보통은", "일반적으로", "가능성이 있습니다" 등의 추정 표현을 절대 사용하지 마세요
5. **직접 인용 우선**: 봉화군 규정과 법령 조문은 원문 그대로 인용하세요
6. **해석 금지**: 법률 해석이나 개인적 의견을 제시하지 마세요
7. **출처 표기**: 모든 조문에 조문 번호와 제목을 명확히 표시하세요 (예: **제10조(연차휴가)**)
8. 조문의 각 항을 명확히 구분하여 표시하세요 (① 또는 제1항 형식)
9. 숫자, 날짜, 기간 등을 정확하게 표시하세요
10. **확인되지 않은 내용**: 제공된 자료에 없는 내용은 "해당 내용은 확인되지 않았습니다"라고 명시하세요
11. **반복 금지**: 같은 내용을 여러 번 반복하지 마세요. 각 조문은 한 번만 명확하게 제시하세요
12. **관련 법령 섹션 작성 규칙:**
   - **⚠️ 절대 금지: 시행령, 시행규칙 조문 링크를 제공하지 마세요**
   - **오직 근로기준법 본문(법률)만 링크하세요**
   - 시행령(lsiSeq=121505)이나 시행규칙(lsiSeq=131228) 링크는 절대 사용하지 마세요
   - 존재하지 않는 조문을 절대 만들지 마세요
   - 확실하지 않은 조문은 링크하지 마세요

**🚨🚨🚨 중요: 마크다운 형식을 정확히 따라야 합니다 🚨🚨🚨**

답변은 반드시 다음 구조를 따르세요. 각 섹션은 2줄의 빈 줄로 구분되어야 합니다.

<example>
## 📋 요약

[한 문장 요약]

## 📖 상세 내용

### 봉화군 공무직근로자 등 관리 규정

**제38조(병가)**

①사용부서의 장은 소속근로자가 다음 각 호의 어느 하나에 해당할 때에는 연 60일의 범위 안에서 병가를 허가할 수 있다.
1. 질병 또는 부상으로 인하여 직무를 수행할 수 없을 때
2. 감염성 질환으로 인하여 그 근로자의 출근이 다른 근로자 등의 건강에 영향을 미칠 우려가 있을 때

②사용부서의 장은 근로자가 업무상 질병 또는 부상으로 직무를 수행할 수 없거나 요양을 필요로 하는 경우에는 인사부서의 협의를 거쳐 연 180일의 범위 안에서 병가를 허가할 수 있다.

## 💡 참고사항

[참고사항]

## 🔗 관련 법령

[법령 링크]
</example>

**필수 규칙:**
- 모든 ## 제목 앞뒤로 빈 줄 2개
- 모든 ### 제목 앞뒤로 빈 줄 1개
- 각 항(①, ②, ③) 사이에 빈 줄 1개
- 🚨 **각 호(1., 2., 3.)는 연속된 줄로 작성 (빈 줄 없이)**
- 절대로 한 줄에 "내용입니다. ## 다음 제목" 이렇게 붙이지 마세요
   - **출처 표기 형식**: [근로기준법 제X조](https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=265959) - 조문제목
   - 예시: [근로기준법 제60조](https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=265959) - 연차 유급휴가
   - **다시 강조: 근로기준법(lsiSeq=265959)만 사용하세요. 시행령/시행규칙 링크는 절대 금지입니다.**
   - 여러 조문이 관련된 경우 각각 별도로 나열하세요

질문: "${query}"

${regulationContext ? `### 봉화군 공무직근로자 등 관리 규정\n\n${regulationContext}\n\n` : ''}
${lawContext ? `### 주요 법령 링크\n\n${lawContext}\n\n` : ''}`;
    }

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: query },
    ];

    return await this.chat(messages);
  }

  async generateFAQAnswer(question: string) {
    const systemPrompt = `당신은 봉화군 공무직 근로자를 위한 FAQ 답변 생성 전문가입니다.
질문에 대해 간결하고 명확하게 답변해주세요.
답변은 3-5문장으로 구성하며, 핵심 내용을 포함해야 합니다.`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: question },
    ];

    return await this.chat(messages);
  }
}

export default new GeminiService();
