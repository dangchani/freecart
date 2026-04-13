import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, CheckCircle } from 'lucide-react';
import { findLoginIdByContact } from '@/lib/auth';
import { format } from 'date-fns';
import { PageSection } from '@/components/theme/PageSection';

type Method = 'email' | 'phone';

interface Result {
  loginId: string;
  createdAt: string;
}

export default function ForgotIdPage() {
  const [name, setName]       = useState('');
  const [method, setMethod]   = useState<Method>('email');
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<Result | null>(null);
  const [error, setError]     = useState('');

  function handleMethodChange(m: Method) {
    setMethod(m);
    setContact('');
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('이름을 입력해주세요.'); return; }
    if (!contact.trim()) {
      setError(method === 'email' ? '이메일을 입력해주세요.' : '전화번호를 입력해주세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await findLoginIdByContact({ name: name.trim(), method, contact: contact.trim() });
      setResult(res);
    } catch (err) {
      if (err instanceof Error && err.message === 'NOT_FOUND') {
        setError('입력하신 정보와 일치하는 계정을 찾을 수 없습니다.');
      } else {
        setError('조회 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageSection id="forgot-id" />
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="w-full max-w-md">
          <Link
            to="/auth/login"
            className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            로그인으로 돌아가기
          </Link>

          <Card className="p-8">
            {result ? (
              /* 결과 화면 */
              <div className="text-center">
                <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
                <h1 className="mb-1 text-xl font-bold">아이디 찾기 완료</h1>
                <p className="mb-6 text-sm text-gray-500">가입하신 아이디는 아래와 같습니다.</p>

                <div className="mb-6 rounded-lg bg-gray-50 px-6 py-4">
                  <p className="text-xs text-gray-400 mb-1">아이디</p>
                  <p className="text-xl font-bold tracking-wide">{result.loginId}</p>
                  <p className="mt-2 text-xs text-gray-400">
                    가입일: {format(new Date(result.createdAt), 'yyyy년 MM월 dd일')}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Link to="/auth/login" className="flex-1">
                    <Button className="w-full">로그인하기</Button>
                  </Link>
                  <Link to="/auth/forgot-password" className="flex-1">
                    <Button variant="outline" className="w-full">비밀번호 찾기</Button>
                  </Link>
                </div>

                <button
                  type="button"
                  className="mt-4 text-sm text-gray-400 hover:text-gray-600"
                  onClick={() => { setResult(null); setName(''); setContact(''); }}
                >
                  다시 찾기
                </button>
              </div>
            ) : (
              /* 입력 화면 */
              <>
                <div className="mb-6 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                    <User className="h-6 w-6 text-blue-600" />
                  </div>
                  <h1 className="text-xl font-bold">아이디 찾기</h1>
                  <p className="mt-1 text-sm text-gray-500">
                    가입 시 입력하신 이름과 이메일 또는 전화번호로 아이디를 찾을 수 있습니다.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* 이름 */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      이름 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="가입 시 입력한 이름"
                      className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                      autoFocus
                    />
                  </div>

                  {/* 찾기 방법 탭 */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">찾기 방법</label>
                    <div className="flex rounded-md border overflow-hidden">
                      <button
                        type="button"
                        onClick={() => handleMethodChange('email')}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${
                          method === 'email'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        이메일
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMethodChange('phone')}
                        className={`flex-1 py-2 text-sm font-medium transition-colors border-l ${
                          method === 'phone'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        전화번호
                      </button>
                    </div>
                  </div>

                  {/* 이메일 또는 전화번호 */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      {method === 'email' ? '이메일' : '전화번호'}
                    </label>
                    {method === 'email' ? (
                      <input
                        key="email"
                        type="email"
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        placeholder="가입 시 입력한 이메일"
                        className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    ) : (
                      <input
                        key="phone"
                        type="tel"
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        placeholder="010-0000-0000"
                        className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    )}
                  </div>

                  {error && (
                    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
                  )}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? '조회 중...' : '아이디 찾기'}
                  </Button>
                </form>

                <p className="mt-4 text-center text-sm text-gray-500">
                  비밀번호를 잊으셨나요?{' '}
                  <Link to="/auth/forgot-password" className="font-medium text-blue-600 hover:underline">
                    비밀번호 찾기
                  </Link>
                </p>
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
