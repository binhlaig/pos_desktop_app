export type RegisterBusinessType =
  | "SUPERMARKET"
  | "RESTAURANT"
  | "FASHION"
  | "FRUIT";

export type RegisterProduct = {
  id: string;
  dbId?: string;
  sku?: string | null;
  barcode?: string | null;
  name: string;
  price: number;
  category?: string | null;
  taxable?: boolean;
  stock?: number | null;
  imagePath?: string | null;
  variantId?: string | null;
  color?: string | null;
  size?: string | null;
  variantBarcode?: string | null;
  unit?: string | null;
  saleType?: string | null;
};

export type RegisterCartItem = {
  id: string;
  dbId?: string;
  sku?: string | null;
  barcode?: string | null;
  imagePath?: string | null;
  name: string;
  qty: number;
  price: number;
  taxable: boolean;
  discount: number;
  variantId?: string | null;
  color?: string | null;
  size?: string | null;
  variantBarcode?: string | null;
  unit?: string | null;
  saleType?: string | null;
};

export type ReceiptItemPayload = {
  productId?: string;
  barcode?: string | null;
  sku?: string | null;
  productName: string;
  qty: number;
  price: number;
  discountPercent: number;
  taxable: boolean;
  lineTotal: number;
  variantId?: string | null;
  color?: string | null;
  size?: string | null;
  variantBarcode?: string | null;
  unit?: string | null;
  saleType?: string | null;
};

export type AddItemToCartParams = {
  cart: RegisterCartItem[];
  product: RegisterProduct;
  qty?: number;
};

export type AddItemToCartResult = {
  cart: RegisterCartItem[];
  added: boolean;
  error?: string;
};

export interface RegisterAdapter {
  businessType: RegisterBusinessType;
  addItemToCart(params: AddItemToCartParams): AddItemToCartResult;
  getCartItemSubtitle(item: RegisterCartItem): string;
  calculateLineTotal(item: RegisterCartItem): number;
  prepareReceiptItemPayload(item: RegisterCartItem): ReceiptItemPayload;
}
