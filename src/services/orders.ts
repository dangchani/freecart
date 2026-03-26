import { createClient } from '@/lib/supabase/client';
import type { Order, OrderItem } from '@/types';

function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `ORD-${year}${month}${day}-${random}`;
}

function mapOrder(order: any): Order {
  return {
    id: order.id,
    orderNumber: order.order_number,
    userId: order.user_id,
    status: order.status,
    items:
      order.items?.map((item: any) => ({
        id: item.id,
        orderId: item.order_id,
        productId: item.product_id,
        variantId: item.variant_id,
        productName: item.product_name,
        optionText: item.option_text,
        productImage: item.product_image,
        unitPrice: item.unit_price,
        quantity: item.quantity,
        discountAmount: item.discount_amount,
        totalPrice: item.total_price,
        status: item.status,
      })) || [],
    subtotal: order.subtotal,
    discountAmount: order.discount_amount || 0,
    couponDiscount: order.coupon_discount || 0,
    shippingFee: order.shipping_fee || 0,
    usedPoints: order.used_points || 0,
    usedDeposit: order.used_deposit || 0,
    totalAmount: order.total_amount,
    ordererName: order.orderer_name,
    ordererPhone: order.orderer_phone,
    recipientName: order.recipient_name,
    recipientPhone: order.recipient_phone,
    postalCode: order.postal_code,
    address1: order.address1,
    address2: order.address2,
    shippingMessage: order.shipping_message,
    paymentMethod: order.payment_method,
    paidAt: order.paid_at,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

export async function createOrder(
  userId: string,
  items: { productId: string; productName: string; quantity: number; unitPrice: number; productImage?: string }[],
  shippingInfo: {
    ordererName: string;
    ordererPhone: string;
    recipientName: string;
    recipientPhone: string;
    postalCode: string;
    address1: string;
    address2?: string;
    shippingMessage?: string;
    // 쿠폰/포인트 정보 추가
    couponId?: string;
    couponDiscount?: number;
    pointsUsed?: number;
  },
  paymentMethod: string
): Promise<Order> {
  const supabase = createClient();

  const { getShippingSettings } = await import('@/services/settings');
  const { shippingFee: baseFee, freeShippingThreshold } = await getShippingSettings();

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const shippingFee = subtotal >= freeShippingThreshold ? 0 : baseFee;
  const couponDiscount = shippingInfo.couponDiscount || 0;
  const pointsUsed = shippingInfo.pointsUsed || 0;
  const totalAmount = subtotal + shippingFee - couponDiscount - pointsUsed;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number: generateOrderNumber(),
      user_id: userId,
      subtotal,
      shipping_fee: shippingFee,
      discount_amount: 0,
      coupon_id: shippingInfo.couponId || null,
      coupon_discount: couponDiscount,
      used_points: pointsUsed,
      used_deposit: 0,
      total_amount: totalAmount,
      orderer_name: shippingInfo.ordererName,
      orderer_phone: shippingInfo.ordererPhone,
      recipient_name: shippingInfo.recipientName,
      recipient_phone: shippingInfo.recipientPhone,
      postal_code: shippingInfo.postalCode,
      address1: shippingInfo.address1,
      address2: shippingInfo.address2 || null,
      shipping_message: shippingInfo.shippingMessage || null,
      payment_method: paymentMethod,
      status: 'pending',
    })
    .select()
    .single();

  if (orderError) throw orderError;

  const orderItems = items.map((item) => ({
    order_id: order.id,
    product_id: item.productId,
    product_name: item.productName,
    product_image: item.productImage || null,
    unit_price: item.unitPrice,
    quantity: item.quantity,
    discount_amount: 0,
    total_price: item.unitPrice * item.quantity,
    status: 'pending',
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);

  if (itemsError) throw itemsError;

  return mapOrder({ ...order, items: [] });
}

export async function getOrders(userId: string): Promise<Order[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      items:order_items(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data?.map(mapOrder) || [];
}

export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      items:order_items(*)
    `)
    .eq('order_number', orderNumber)
    .single();

  if (error) throw error;
  if (!data) return null;

  return mapOrder(data);
}

export async function cancelOrder(orderId: string) {
  const supabase = createClient();

  const { error } = await supabase
    .from('orders')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) throw error;
}
