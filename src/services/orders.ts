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

export async function createOrder(
  userId: string,
  items: { productId: string; quantity: number; price: number; options?: Record<string, string> }[],
  shippingInfo: {
    address: string;
    phone: string;
    name: string;
  },
  paymentMethod: string
): Promise<Order> {
  const supabase = createClient();

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingCost = subtotal >= 50000 ? 0 : 3000; // 5만원 이상 무료배송
  const total = subtotal + shippingCost;

  // 주문 생성
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number: generateOrderNumber(),
      user_id: userId,
      subtotal,
      shipping_cost: shippingCost,
      discount: 0,
      total,
      shipping_address: shippingInfo.address,
      shipping_phone: shippingInfo.phone,
      shipping_name: shippingInfo.name,
      payment_method: paymentMethod,
      status: 'pending',
      payment_status: 'pending',
    })
    .select()
    .single();

  if (orderError) throw orderError;

  // 주문 항목 생성
  const orderItems = items.map((item) => ({
    order_id: order.id,
    product_id: item.productId,
    product_name: '', // TODO: 상품명 가져오기
    price: item.price,
    quantity: item.quantity,
    options: item.options,
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);

  if (itemsError) throw itemsError;

  return {
    id: order.id,
    orderNumber: order.order_number,
    userId: order.user_id,
    status: order.status,
    items: [],
    subtotal: parseFloat(order.subtotal),
    shippingCost: parseFloat(order.shipping_cost),
    discount: parseFloat(order.discount),
    total: parseFloat(order.total),
    shippingAddress: order.shipping_address,
    shippingPhone: order.shipping_phone,
    shippingName: order.shipping_name,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    memo: order.memo,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

export async function getOrders(userId: string): Promise<Order[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      *,
      items:order_items(*)
    `
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (
    data?.map((order) => ({
      id: order.id,
      orderNumber: order.order_number,
      userId: order.user_id,
      status: order.status,
      items:
        order.items?.map((item: any) => ({
          id: item.id,
          orderId: item.order_id,
          productId: item.product_id,
          productName: item.product_name,
          price: parseFloat(item.price),
          quantity: item.quantity,
          options: item.options,
        })) || [],
      subtotal: parseFloat(order.subtotal),
      shippingCost: parseFloat(order.shipping_cost),
      discount: parseFloat(order.discount),
      total: parseFloat(order.total),
      shippingAddress: order.shipping_address,
      shippingPhone: order.shipping_phone,
      shippingName: order.shipping_name,
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      memo: order.memo,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    })) || []
  );
}

export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      *,
      items:order_items(*)
    `
    )
    .eq('order_number', orderNumber)
    .single();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    orderNumber: data.order_number,
    userId: data.user_id,
    status: data.status,
    items:
      data.items?.map((item: any) => ({
        id: item.id,
        orderId: item.order_id,
        productId: item.product_id,
        productName: item.product_name,
        price: parseFloat(item.price),
        quantity: item.quantity,
        options: item.options,
      })) || [],
    subtotal: parseFloat(data.subtotal),
    shippingCost: parseFloat(data.shipping_cost),
    discount: parseFloat(data.discount),
    total: parseFloat(data.total),
    shippingAddress: data.shipping_address,
    shippingPhone: data.shipping_phone,
    shippingName: data.shipping_name,
    paymentMethod: data.payment_method,
    paymentStatus: data.payment_status,
    memo: data.memo,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function cancelOrder(orderId: string) {
  const supabase = createClient();

  const { error } = await supabase
    .from('orders')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) throw error;
}
