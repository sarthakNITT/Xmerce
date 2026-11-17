/*
 * Public frontend configuration.
 * Never add database credentials, payment secrets, or webhook secrets here.
 *
 * Change mode to "api" when the order endpoints are available.
 */

export const orderConfig = {
  mode: "demo",
  apiBase: "/api",
  pollInterval: 5000,

  routes: {
    shop: "/search?fresh=1",
    support: "/#help",
    payment: "/checkout",
  },

  // Supply your authentication team's CSRF header when required.
  mutationHeaders: () => ({}),
};

const DEMO_NUMBER = "b36278f8-7b73-4b5c-b049-e4b983ca30d4";
const demoOrders = new Map();

export { DEMO_NUMBER };

function demoOrder(number, variant) {
  const created = new Date();
  const earliest = new Date(created);
  const latest = new Date(created);

  earliest.setDate(earliest.getDate() + 3);
  latest.setDate(latest.getDate() + 5);

  return {
    orderNumber: number,
    createdAt: created.toISOString(),
    currency: "INR",

    // API responses should already contain the masked email.
    customer: {
      firstName: "Alex",
      maskedEmail: "a***@example.com",
    },

    status: "CONFIRMED",
    canCancel: variant === "paid" || variant === "cod",
    cancelledAt: null,

    delivery: {
      earliest: earliest.toISOString(),
      latest: latest.toISOString(),
      method: "Standard delivery",
    },

    address: {
      recipient: "Alex Morgan",
      line1: "42 Example Avenue",
      line2: "Apartment 3B",
      city: "Bengaluru",
      region: "Karnataka",
      postalCode: "560001",
      country: "India",
    },

    items: [
      {
        id: "line-001",
        productId: "LAP-101",
        name: "NovaBook Air 14",
        specs: "Core Ultra 5 · 16 GB RAM · 512 GB SSD · 14-inch 2.2K",
        image: null,
        quantity: 1,
        unitPrice: "64990.00",
        lineTotal: "64990.00",
        etaStart: earliest.toISOString(),
        etaEnd: latest.toISOString(),
      },
    ],

    payment: {
      status:
        variant === "pending"
          ? "PENDING"
          : variant === "failed"
            ? "FAILED"
            : variant === "cod"
              ? "COD"
              : "PAID",

      method: variant === "cod" ? "COD" : "CARD",
      last4: variant === "cod" ? null : "4242",
    },

    totals: {
      subtotal: "64990.00",
      shipping: "0.00",
      discount: "0.00",
      tax: "0.00",
      grandTotal: "64990.00",
    },

    // Enable only when a real invoice endpoint is available.
    invoiceAvailable: false,

    timeline: [
      {
        key: "CONFIRMED",
        label: "Order confirmed",
        completedAt: created.toISOString(),
      },
      {
        key: "SHIPPED",
        label: "On its way",
        completedAt: null,
      },
      {
        key: "DELIVERED",
        label: "Delivered",
        completedAt: null,
      },
    ],

    // This is a curated demo recommendation, not an invented sales statistic.
    recommendationSource: "CURATED",

    recommendations: [
      {
        id: "ADD-501",
        name: "NovaCare 3-Year Plan",
        description: "Accidental damage cover for one laptop",
        price: "5999.00",
        image: null,
        href: "/search?fresh=1&q=NovaCare",
      },
    ],

    emailStatus: "NOT_CONNECTED",
    demo: true,
  };
}

function validateOrder(order) {
  const moneyFields = [
    "subtotal",
    "shipping",
    "discount",
    "tax",
    "grandTotal",
  ];

  const validMoney = (value) =>
    /^(0|[1-9]\d*)(\.\d{1,2})?$/.test(String(value));

  if (
    !order ||
    typeof order.orderNumber !== "string" ||
    !Number.isFinite(Date.parse(order.createdAt)) ||
    order.currency !== "INR" ||
    !order.customer ||
    typeof order.customer.maskedEmail !== "string" ||
    !order.address ||
    !Array.isArray(order.items) ||
    !order.items.length ||
    !Array.isArray(order.timeline) ||
    order.timeline.length !== 3 ||
    !Array.isArray(order.recommendations) ||
    !moneyFields.every((field) => validMoney(order.totals?.[field])) ||
    !["PAID", "COD", "PENDING", "FAILED"].includes(order.payment?.status) ||
    !["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED"].includes(
      order.status,
    )
  ) {
    throw new Error("The order service returned an invalid order.");
  }

  for (const item of order.items) {
    if (
      typeof item.id !== "string" ||
      typeof item.name !== "string" ||
      typeof item.specs !== "string" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      !validMoney(item.unitPrice) ||
      !validMoney(item.lineTotal)
    ) {
      throw new Error("The order contains invalid item information.");
    }
  }

  return order;
}

async function request(path, { method = "GET", signal } = {}) {
  const response = await fetch(
    `${orderConfig.apiBase.replace(/\/$/, "")}${path}`,
    {
      method,
      signal,
      credentials: "same-origin",
      cache: "no-store",

      headers: {
        Accept: "application/json",
        ...(method !== "GET" ? orderConfig.mutationHeaders() : {}),
      },
    },
  );

  if (!response.ok) {
    const messages = {
      401: "Please sign in to view this order.",
      403: "You do not have access to this order.",
      404: "We could not find this order.",
      409: "The order changed and this action is no longer available.",
    };

    throw new Error(
      messages[response.status] ||
        "We could not reach the order service. Please try again.",
    );
  }

  return validateOrder(await response.json());
}

export const orderService = {
  async getOrder(number, { signal, demoVariant = "paid" } = {}) {
    if (orderConfig.mode === "api") {
      return request(`/orders/${encodeURIComponent(number)}`, { signal });
    }

    if (signal?.aborted) {
      throw new DOMException("Request aborted", "AbortError");
    }

    const variant = ["paid", "cod", "pending", "failed"].includes(demoVariant)
      ? demoVariant
      : "paid";

    const key = `${number}:${variant}`;

    if (!demoOrders.has(key)) {
      demoOrders.set(key, demoOrder(number, variant));
    }

    return structuredClone(demoOrders.get(key));
  },

  async cancelOrder(number, { demoVariant = "paid" } = {}) {
    if (orderConfig.mode === "api") {
      return request(`/orders/${encodeURIComponent(number)}/cancel`, {
        method: "POST",
      });
    }

    const order = await this.getOrder(number, { demoVariant });

    if (
      !order.canCancel ||
      !["CONFIRMED", "PACKED"].includes(order.status)
    ) {
      throw new Error("This order can no longer be cancelled.");
    }

    order.status = "CANCELLED";
    order.canCancel = false;
    order.cancelledAt = new Date().toISOString();

    demoOrders.set(`${number}:${demoVariant}`, order);
    return structuredClone(order);
  },

  async downloadInvoice(number) {
    if (orderConfig.mode !== "api") {
      throw new Error("Invoice downloads require the connected order service.");
    }

    const response = await fetch(
      `${orderConfig.apiBase.replace(/\/$/, "")}/orders/${encodeURIComponent(number)}/invoice`,
      {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/pdf" },
      },
    );

    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes("application/pdf")
    ) {
      throw new Error("The invoice is unavailable. Please try again later.");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `NovaTech-${number.replace(/[^a-zA-Z0-9-]/g, "")}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },
};
