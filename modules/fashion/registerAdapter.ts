import type {
  AddItemToCartParams,
  AddItemToCartResult,
  ReceiptItemPayload,
  RegisterAdapter,
  RegisterCartItem,
  RegisterProduct,
} from "@/modules/shared/registerTypes";

function getProductLineId(product: RegisterProduct) {
  return product.variantBarcode || product.barcode || product.sku || product.id;
}

function isSameProduct(item: RegisterCartItem, product: RegisterProduct) {
  const lineId = getProductLineId(product);

  return (
    item.id === lineId ||
    (!!product.variantId && item.variantId === product.variantId) ||
    (!!product.variantBarcode &&
      item.variantBarcode === product.variantBarcode) ||
    (!!product.barcode && item.barcode === product.barcode) ||
    (!!product.sku && item.sku === product.sku) ||
    (!!product.dbId && item.dbId === product.dbId)
  );
}

function createCartItem(product: RegisterProduct, qty: number): RegisterCartItem {
  return {
    id: getProductLineId(product),
    dbId: product.dbId,
    sku: product.sku ?? null,
    barcode: product.barcode ?? null,
    imagePath: product.imagePath ?? null,
    name: product.name,
    qty,
    price: product.price,
    taxable: !!product.taxable,
    discount: 0,
    variantId: product.variantId ?? null,
    color: product.color ?? null,
    size: product.size ?? null,
    variantBarcode: product.variantBarcode ?? null,
  };
}

function addItemToCart({
  cart,
  product,
  qty = 1,
}: AddItemToCartParams): AddItemToCartResult {
  const availableStock = Number(product.stock ?? 0);

  if (availableStock <= 0) {
    return {
      cart,
      added: false,
      error: `${product.name} is out of stock`,
    };
  }

  const found = cart.find((item) => isSameProduct(item, product));

  if (found) {
    const nextQty = found.qty + qty;

    if (nextQty > availableStock) {
      return {
        cart,
        added: false,
        error: `${product.name} stock မလုံလောက်ပါ။ Available stock: ${availableStock}`,
      };
    }

    return {
      cart: cart.map((item) =>
        item.id === found.id ? { ...item, qty: Math.min(999, nextQty) } : item
      ),
      added: true,
    };
  }

  if (qty > availableStock) {
    return {
      cart,
      added: false,
      error: `${product.name} stock မလုံလောက်ပါ။ Available stock: ${availableStock}`,
    };
  }

  return {
    cart: [...cart, createCartItem(product, qty)],
    added: true,
  };
}

function getCartItemSubtitle(item: RegisterCartItem) {
  return [
    item.color,
    item.size,
    item.variantBarcode,
    item.barcode,
    item.sku,
    item.dbId,
  ]
    .filter(Boolean)
    .join(" · ");
}

function calculateLineTotal(item: RegisterCartItem) {
  return item.qty * item.price * (1 - item.discount);
}

function prepareReceiptItemPayload(item: RegisterCartItem): ReceiptItemPayload {
  return {
    productId: String(item.dbId || item.id),
    barcode: item.variantBarcode || item.barcode || item.id,
    sku: item.sku || "",
    productName: item.name,
    qty: Number(item.qty || 1),
    price: Math.round(item.price),
    discountPercent: Math.round(item.discount * 100),
    taxable: item.taxable,
    lineTotal: Math.round(calculateLineTotal(item)),
    variantId: item.variantId ?? null,
    color: item.color ?? null,
    size: item.size ?? null,
    variantBarcode: item.variantBarcode ?? null,
  };
}

export const fashionRegisterAdapter: RegisterAdapter = {
  businessType: "FASHION",
  addItemToCart,
  getCartItemSubtitle,
  calculateLineTotal,
  prepareReceiptItemPayload,
};
