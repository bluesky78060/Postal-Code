import { Search, AlertCircle, FileText, Clock, Briefcase, Umbrella, Scale, Shield, Loader2, Check } from "lucide-react";
import { Card, CardContent } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Button } from "./components/ui/button";
import { useState } from "react";
import { searchAPI } from "./services/api";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [copiedText, setCopiedText] = useState<string>("");
  const [searchType, setSearchType] = useState<'all' | 'regulation' | 'law'>('all');
  const [warnings, setWarnings] = useState<string[]>([]);

  const faqs = [
    { icon: "📍", text: "공무직의 정년은 몇 세인가요?" },
    { icon: "📍", text: "연차휴가는 몇 일인가요?" },
    { icon: "📍", text: "출산휴가는 어떻게 사용하나요?" },
    { icon: "📍", text: "병가는 몇 일까지 가능한가요?" },
  ];

  const categories = [
    { icon: FileText, label: "총칙", color: "from-blue-400 to-cyan-400" },
    { icon: Clock, label: "채용", color: "from-purple-400 to-pink-400" },
    { icon: Briefcase, label: "근무", color: "from-orange-400 to-red-400" },
    { icon: Umbrella, label: "휴가", color: "from-green-400 to-emerald-400" },
    { icon: Scale, label: "징계", color: "from-indigo-400 to-blue-400" },
    { icon: Shield, label: "괴롭힘", color: "from-rose-400 to-pink-400" },
  ];

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError("검색어를 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setError("");
    setSearchResult("");
    setWarnings([]);

    try {
      const response = await searchAPI.search(searchQuery, searchType);
      setSearchResult(response.data.answer);
      if (response.data.warnings) {
        setWarnings(response.data.warnings);
      }
    } catch (err) {
      setError("검색 중 오류가 발생했습니다. 다시 시도해주세요.");
      console.error("Search error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFAQClick = async (question: string) => {
    setSearchQuery(question);
    setIsLoading(true);
    setError("");
    setSearchResult("");

    try {
      const response = await searchAPI.search(question, searchType);
      setSearchResult(response.data.answer);
    } catch (err) {
      setError("검색 중 오류가 발생했습니다. 다시 시도해주세요.");
      console.error("FAQ error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToClipboard = async (text: string) => {
    try {
      // 정확한 조문 번호만 추출 (예: "근로기준법 제60조" → "제60조")
      const articleMatch = text.match(/제(\d+(?:의\d+)?)조/);

      let copyText = text;
      if (articleMatch) {
        // 정확한 법령 페이지 조문 형식으로 복사
        copyText = `제${articleMatch[1]}조`;
      }

      await navigator.clipboard.writeText(copyText);
      setCopiedText(text);
      setTimeout(() => setCopiedText(""), 2000);
    } catch (err) {
      console.error("복사 실패:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-indigo-50/30 to-purple-50/30">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-400/90 via-indigo-400/90 to-purple-400/90 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>

        <div className="relative max-w-5xl mx-auto px-4 py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md rounded-full px-5 py-2 mb-6 border border-white/20">
            <Scale className="w-4 h-4" />
            <span className="text-sm">공무직 근로자를 위한 법률 정보</span>
          </div>

          <h1 className="text-4xl md:text-5xl mb-4 tracking-tight">
            봉화군 공무직 노동법 검색
          </h1>
          <p className="text-lg text-white/90 max-w-2xl mx-auto">
            공무직근로자를 위한 법령 정보 검색 및 질의응답 시스템
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 -mt-8 pb-16">
        {/* Search Section */}
        <Card className="shadow-lg border border-white/60 bg-white/90 backdrop-blur-md mb-12">
          <CardContent className="p-6">
            {/* Search Type Selection */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSearchType('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  searchType === 'all'
                    ? 'bg-gradient-to-br from-blue-400 to-indigo-400 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                disabled={isLoading}
              >
                전체
              </button>
              <button
                onClick={() => setSearchType('regulation')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  searchType === 'regulation'
                    ? 'bg-gradient-to-br from-blue-400 to-indigo-400 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                disabled={isLoading}
              >
                봉화군 규정만
              </button>
              <button
                onClick={() => setSearchType('law')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  searchType === 'law'
                    ? 'bg-gradient-to-br from-blue-400 to-indigo-400 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                disabled={isLoading}
              >
                법령만
              </button>
            </div>

            {/* Search Input */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="무엇이 궁금하신가요? 예) 연차휴가는 어떻게 사용하나요?"
                  className="pl-12 h-14 border-gray-200/50 bg-white/50 focus:ring-2 focus:ring-blue-300/50 focus:border-blue-300 transition-all rounded-xl"
                  disabled={isLoading}
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={isLoading}
                className="h-14 px-8 bg-gradient-to-br from-blue-400 to-indigo-400 hover:from-blue-500 hover:to-indigo-500 transition-all duration-300 shadow-md hover:shadow-lg rounded-xl"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    검색 중...
                  </>
                ) : (
                  '검색'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Verification Warnings */}
        {warnings.length > 0 && (
          <Card className="shadow-lg border border-orange-200 bg-orange-50/95 backdrop-blur-sm mb-4">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-orange-800 mb-2">검증 경고</h3>
                  <ul className="text-sm text-orange-700 space-y-1">
                    {warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search Result */}
        {searchResult && (
          <Card className="shadow-lg border border-blue-200 bg-white/95 backdrop-blur-sm mb-4">
            <CardContent className="p-6">
              <div className="flex items-start gap-3 mb-3">
                <div className="bg-gradient-to-br from-blue-400 to-indigo-400 p-2 rounded-lg">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800">검색 결과</h3>
              </div>
              <div className="prose prose-base max-w-none text-gray-700 leading-relaxed
                [&>h2]:text-xl [&>h2]:font-bold [&>h2]:text-gray-800 [&>h2]:mt-6 [&>h2]:mb-4 [&>h2]:border-b [&>h2]:border-gray-200 [&>h2]:pb-2
                [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:text-gray-800 [&>h3]:mt-5 [&>h3]:mb-3
                [&>p]:mb-4 [&>p]:leading-7
                [&>ul]:space-y-2 [&>ul]:mb-4 [&>ul]:ml-6 [&>li]:leading-7
                [&>ol]:list-decimal [&>ol]:space-y-2 [&>ol]:mb-4 [&>ol]:ml-6 [&>ol]:pl-2 [&>ol>li]:list-item [&>ol>li]:pl-2
                [&>blockquote]:border-l-4 [&>blockquote]:border-blue-400 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-gray-600 [&>blockquote]:my-4
                [&>strong]:font-bold [&>strong]:text-gray-900
                [&>code]:bg-gray-100 [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded [&>code]:text-sm [&>code]:text-gray-800
                [&_hr]:my-6 [&_hr]:border-gray-300
              ">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ node, children, ...props }) => {
                      // children을 텍스트로 변환
                      let linkText = '';
                      if (typeof children === 'string') {
                        linkText = children;
                      } else if (Array.isArray(children)) {
                        linkText = children.join('');
                      } else if (children) {
                        linkText = String(children);
                      }

                      // 법령 조문 링크인 경우 (예: "근로기준법 제60조(연차휴가)")
                      const articleMatch = linkText.match(/(제\d+조(?:의\d+)?(?:\([^)]+\))?)/);
                      if (articleMatch) {
                        const articleText = articleMatch[1]; // "제60조(연차휴가)" 또는 "제60조"

                        return (
                          <a
                            {...props}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={async (e) => {
                              // 링크는 정상적으로 열리도록 하고, 복사만 추가
                              await handleCopyToClipboard(articleText);
                            }}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            title={`클릭 시 "${articleText}" 자동 복사`}
                          >
                            {children}
                            {copiedText === articleText && (
                              <span className="inline-flex items-center gap-1 ml-1 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                                <Check className="w-3 h-3" />
                                복사됨
                              </span>
                            )}
                          </a>
                        );
                      }

                      // 일반 링크
                      return (
                        <a {...props} target="_blank" rel="noopener noreferrer">
                          {children}
                        </a>
                      );
                    },
                  }}
                >
                  {searchResult}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 법령 검색 안내 */}
        {searchResult && searchResult.includes('관련 법령') && (
          <Card className="shadow-md border border-blue-200 bg-blue-50/95 backdrop-blur-sm mb-20">
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-800">
                  <p className="font-semibold">💡 법령 조문 검색 방법</p>
                  <p className="text-blue-700 leading-relaxed">
                    법령 링크를 클릭하면 조문 번호가 자동으로 복사됩니다.
                    법령 페이지에서 <kbd className="px-1 py-0.5 bg-white border border-blue-300 rounded text-xs">Ctrl+F</kbd>를 누르고
                    붙여넣기(<kbd className="px-1 py-0.5 bg-white border border-blue-300 rounded text-xs">Ctrl+V</kbd>)하여 해당 조문으로 바로 이동하세요.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Message */}
        {error && (
          <Card className="shadow-lg border border-red-200 bg-red-50/95 backdrop-blur-sm mb-12">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <p className="text-red-700">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* FAQs Section */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-gradient-to-br from-amber-300/80 to-orange-300/80 p-2.5 rounded-xl shadow-sm">
              <AlertCircle className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl text-gray-700">자주 묻는 질문</h2>
          </div>

          <Card className="border border-gray-100 shadow-md bg-white/95 backdrop-blur-sm overflow-hidden rounded-2xl">
            <CardContent className="p-0">
              {faqs.map((faq, index) => (
                <button
                  key={index}
                  onClick={() => handleFAQClick(faq.text)}
                  disabled={isLoading}
                  className="w-full flex items-center gap-4 px-6 py-5 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 transition-all duration-300 border-b last:border-b-0 border-gray-50 group text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-2xl group-hover:scale-105 transition-transform duration-300">
                    {faq.icon}
                  </span>
                  <span className="text-gray-600 group-hover:text-blue-600 transition-colors duration-300">
                    {faq.text}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Additional Info Footer */}
        <div className="mt-12 text-center">
          <Card className="border border-blue-100/50 bg-gradient-to-br from-blue-50/50 via-indigo-50/50 to-purple-50/50 shadow-sm rounded-2xl">
            <CardContent className="p-8">
              <p className="text-gray-600 leading-relaxed">
                궁금하신 사항이나 추가 문의는 언제든지 문의해 주세요.
                <br />
                <span className="text-blue-500">정확한 법령 정보로 여러분의 권리를 보호합니다.</span>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
