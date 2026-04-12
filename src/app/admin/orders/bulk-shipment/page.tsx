import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { transitionOrderStatus } from '@/services/orders';
import { isValidTransition, type OrderStatus } from '@/constants/orderStatus';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import {
  ArrowLeft,
  Upload,
  Check,
  Truck,
  Download,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ShipmentRow {
  order_number: string;
  shipping_company_code: string;
  tracking_number: string;
}

interface ProcessResult {
  order_number: string;
  success: boolean;
  message: string;
}

export default function AdminOrdersBulkShipmentPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<ShipmentRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<ProcessResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth/login');
    }
  }, [user, authLoading, navigate]);

  // CSV parsing helper
  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  // Handle file upload
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setResults([]);
    setShowResults(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split('\n').filter((line) => line.trim());
      if (lines.length < 2) {
        alert('유효한 데이터가 없습니다.');
        return;
      }

      const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/"/g, '').trim());

      const orderNumberIdx = headers.indexOf('order_number');
      const companyCodeIdx = headers.indexOf('shipping_company_code');
      const trackingIdx = headers.indexOf('tracking_number');

      if (orderNumberIdx === -1 || companyCodeIdx === -1 || trackingIdx === -1) {
        alert('필수 컬럼이 없습니다. (order_number, shipping_company_code, tracking_number)');
        return;
      }

      const rows: ShipmentRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length < 3) continue;

        const orderNumber = values[orderNumberIdx]?.replace(/"/g, '').trim();
        const companyCode = values[companyCodeIdx]?.replace(/"/g, '').trim();
        const trackingNumber = values[trackingIdx]?.replace(/"/g, '').trim();

        if (!orderNumber || !companyCode || !trackingNumber) continue;

        rows.push({
          order_number: orderNumber,
          shipping_company_code: companyCode,
          tracking_number: trackingNumber,
        });
      }

      if (rows.length === 0) {
        alert('유효한 데이터가 없습니다.');
        return;
      }

      setPreview(rows);
    };

    reader.readAsText(file);
  }

  // Process bulk shipment
  async function handleConfirmShipment() {
    if (preview.length === 0) return;

    setProcessing(true);
    const processResults: ProcessResult[] = [];

    try {
      const supabase = createClient();

      // Pre-load all shipping companies
      const { data: companies } = await supabase
        .from('shipping_companies')
        .select('id, code');

      const companyMap = new Map<string, string>();
      (companies || []).forEach((c: any) => {
        companyMap.set(c.code, c.id);
      });

      for (const row of preview) {
        try {
          // Find order by order_number
          const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id, status')
            .eq('order_number', row.order_number)
            .maybeSingle();

          if (orderError || !order) {
            processResults.push({
              order_number: row.order_number,
              success: false,
              message: '주문을 찾을 수 없습니다.',
            });
            continue;
          }

          // Find shipping company by code
          const shippingCompanyId = companyMap.get(row.shipping_company_code);
          if (!shippingCompanyId) {
            processResults.push({
              order_number: row.order_number,
              success: false,
              message: `배송사 코드를 찾을 수 없습니다: ${row.shipping_company_code}`,
            });
            continue;
          }

          // Check if shipment already exists
          const { data: existingShipment } = await supabase
            .from('shipments')
            .select('id')
            .eq('order_id', order.id)
            .maybeSingle();

          const shipmentPayload = {
            shipping_company_id: shippingCompanyId,
            tracking_number: row.tracking_number,
            status: 'shipped',
            shipped_at: new Date().toISOString(),
          };

          if (existingShipment) {
            const { error: updateError } = await supabase
              .from('shipments')
              .update(shipmentPayload)
              .eq('id', existingShipment.id);
            if (updateError) throw updateError;
          } else {
            const { error: insertError } = await supabase
              .from('shipments')
              .insert({ order_id: order.id, ...shipmentPayload });
            if (insertError) throw insertError;
          }

          // 상태 머신 경유 (유효한 전이일 때만)
          if (isValidTransition(order.status as OrderStatus, 'shipped')) {
            await transitionOrderStatus(order.id, 'shipped', {
              note: `일괄 운송장 등록: ${row.tracking_number}`,
            });
          }

          processResults.push({
            order_number: row.order_number,
            success: true,
            message: '배송 등록 완료',
          });
        } catch (error) {
          processResults.push({
            order_number: row.order_number,
            success: false,
            message: error instanceof Error ? error.message : '처리 중 오류 발생',
          });
        }
      }
    } catch (error) {
      console.error('Failed to process bulk shipment:', error);
      alert('일괄 배송 처리 중 오류가 발생했습니다.');
    } finally {
      setResults(processResults);
      setShowResults(true);
      setProcessing(false);
    }
  }

  // Download sample CSV
  function handleDownloadSample() {
    const csvContent = 'order_number,shipping_company_code,tracking_number\nORD-20260327-001,cj,1234567890\nORD-20260327-002,hanjin,9876543210';
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bulk_shipment_sample.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  // Reset
  function handleReset() {
    setPreview([]);
    setFileName('');
    setResults([]);
    setShowResults(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  if (authLoading) {
    return <div className="container py-8">로딩 중...</div>;
  }

  return (
    <div className="container py-8">
      <Link to="/admin/orders" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />
        주문 관리로 돌아가기
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">일괄 배송 등록</h1>
        <p className="mt-1 text-gray-500">
          CSV 파일을 업로드하여 여러 주문의 운송장을 한번에 등록할 수 있습니다.
        </p>
      </div>

      {/* Upload section */}
      <Card className="mb-6 p-6">
        <h2 className="mb-2 text-lg font-bold">CSV 파일 업로드</h2>
        <p className="mb-4 text-sm text-gray-500">
          필수 컬럼: order_number, shipping_company_code, tracking_number
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            CSV 파일 선택
          </Button>
          <Button variant="outline" onClick={handleDownloadSample}>
            <Download className="mr-2 h-4 w-4" />
            샘플 CSV 다운로드
          </Button>
          {fileName && (
            <span className="text-sm text-gray-600">{fileName}</span>
          )}
        </div>
      </Card>

      {/* Preview */}
      {preview.length > 0 && !showResults && (
        <Card className="mb-6">
          <div className="flex items-center justify-between p-4 border-b bg-gray-50">
            <h2 className="font-bold">
              <Truck className="mr-2 inline h-4 w-4" />
              미리보기 ({preview.length}건)
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset}>
                취소
              </Button>
              <Button onClick={handleConfirmShipment} disabled={processing}>
                <Check className="mr-2 h-4 w-4" />
                {processing ? '처리 중...' : '배송 등록 확인'}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">#</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">주문번호</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">배송사 코드</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">운송장 번호</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                    <td className="px-4 py-3 font-mono">{row.order_number}</td>
                    <td className="px-4 py-3">{row.shipping_company_code}</td>
                    <td className="px-4 py-3 font-mono">{row.tracking_number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Results */}
      {showResults && results.length > 0 && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 text-center">
              <p className="text-sm text-gray-500">전체</p>
              <p className="text-2xl font-bold">{results.length}건</p>
            </Card>
            <Card className="p-4 text-center bg-green-50 border-green-200">
              <p className="text-sm text-green-700">성공</p>
              <p className="text-2xl font-bold text-green-700">{successCount}건</p>
            </Card>
            <Card className="p-4 text-center bg-red-50 border-red-200">
              <p className="text-sm text-red-700">실패</p>
              <p className="text-2xl font-bold text-red-700">{failCount}건</p>
            </Card>
          </div>

          {/* Detail table */}
          <Card>
            <div className="flex items-center justify-between p-4 border-b bg-gray-50">
              <h2 className="font-bold">처리 결과</h2>
              <Button variant="outline" onClick={handleReset}>
                새로 업로드
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">#</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">주문번호</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">결과</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">상세</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {results.map((result, index) => (
                    <tr key={index} className={result.success ? 'hover:bg-gray-50' : 'bg-red-50 hover:bg-red-100'}>
                      <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                      <td className="px-4 py-3 font-mono">{result.order_number}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={result.success ? 'default' : 'destructive'}>
                          {result.success ? '성공' : '실패'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{result.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
